import express from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db.js";
import { auth, permit, tenantRequired } from "./auth.js";
const zero = () => new Prisma.Decimal(0);
type Row = {
  name: string;
  orders: Set<string>;
  units: number;
  revenue: Prisma.Decimal;
  cost: Prisma.Decimal;
  costComplete: boolean;
};
export async function businessReport(
  tenantId: string,
  days: number,
  storeId?: string,
) {
  const since = new Date(Date.now() - days * 86400000),
    where = { tenantId, ...(storeId ? { storeId } : {}) };
  const [tenant, orders, inventory, counts, accounts, entries, jobs, users] =
    await Promise.all([
      db.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { currency: true },
      }),
      db.order.findMany({
        where: {
          ...where,
          createdAt: { gte: since },
          status: { in: ["COMPLETED", "REFUNDED", "PARTIALLY_REFUNDED"] },
        },
        include: {
          store: true,
          items: { include: { variant: { include: { product: true } } } },
        },
      }),
      db.inventory.findMany({
        where,
        include: { store: true, variant: { include: { product: true } } },
      }),
      db.stockCount.findMany({
        where: { ...where, createdAt: { gte: since } },
      }),
      db.loyaltyAccount.findMany({
        where: { tenantId },
        include: {
          customer: {
            select: {
              orders: {
                where: { status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] } },
                select: { id: true },
              },
            },
          },
        },
      }),
      db.loyaltyEntry.findMany({
        where: { tenantId, createdAt: { gte: since } },
      }),
      db.tryOnJob.groupBy({
        by: ["status"],
        where: { tenantId, createdAt: { gte: since } },
        _count: true,
      }),
      db.user.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
    ]);
  let gross = zero(),
    refunds = zero(),
    net = zero(),
    cost = zero(),
    allCosts = true;
  const dimensions = {
    stores: new Map<string, Row>(),
    categories: new Map<string, Row>(),
    brands: new Map<string, Row>(),
    products: new Map<string, Row>(),
    employees: new Map<string, Row>(),
  };
  const sold = new Map<string, number>();
  const lastSold = new Map<string, Date>();
  const sizeUnits = new Map<string, number>();
  const add = (
    map: Map<string, Row>,
    key: string,
    name: string,
    orderId: string,
    units: number,
    revenue: Prisma.Decimal,
    lineCost: Prisma.Decimal,
    captured: boolean,
  ) => {
    const row = map.get(key) ?? {
      name,
      orders: new Set<string>(),
      units: 0,
      revenue: zero(),
      cost: zero(),
      costComplete: true,
    };
    row.orders.add(orderId);
    row.units += units;
    row.revenue = row.revenue.plus(revenue);
    row.cost = row.cost.plus(lineCost);
    row.costComplete &&= captured;
    map.set(key, row);
  };
  for (const order of orders) {
    gross = gross.plus(order.total);
    refunds = refunds.plus(order.refundedTotal);
    net = net.plus(order.total.minus(order.refundedTotal));
    for (const line of order.items) {
      const units = line.quantity - line.returnedQuantity,
        revenue = line.unitPrice
          .mul(line.quantity)
          .minus(line.discountTotal)
          .minus(line.returnedAmount),
        netOfTax = revenue
          .div(new Prisma.Decimal(1).plus(order.taxRate.div(100)))
          .toDecimalPlaces(2),
        lineCost = line.unitCost.mul(units);
      cost = cost.plus(lineCost);
      if (units && !line.costCaptured) allCosts = false;
      const product = line.variant.product;
      add(
        dimensions.stores,
        order.storeId,
        order.store.name,
        order.id,
        units,
        netOfTax,
        lineCost,
        line.costCaptured || units === 0,
      );
      add(
        dimensions.categories,
        product.category,
        product.category,
        order.id,
        units,
        netOfTax,
        lineCost,
        line.costCaptured || units === 0,
      );
      add(
        dimensions.brands,
        product.brand,
        product.brand || "Unspecified",
        order.id,
        units,
        netOfTax,
        lineCost,
        line.costCaptured || units === 0,
      );
      add(
        dimensions.products,
        product.id,
        product.name,
        order.id,
        units,
        netOfTax,
        lineCost,
        line.costCaptured || units === 0,
      );
      add(
        dimensions.employees,
        order.cashierId,
        users.find((u) => u.id === order.cashierId)?.name ??
          "Online / unassigned",
        order.id,
        units,
        netOfTax,
        lineCost,
        line.costCaptured || units === 0,
      );
      const stockKey = `${order.storeId}:${line.variantId}`;
      sold.set(stockKey, (sold.get(stockKey) ?? 0) + units);
      if (units > 0) {
        sizeUnits.set(
          line.variant.size,
          (sizeUnits.get(line.variant.size) ?? 0) + units,
        );
        if (
          !lastSold.get(stockKey) ||
          lastSold.get(stockKey)! < order.createdAt
        )
          lastSold.set(stockKey, order.createdAt);
      }
    }
  }
  const inventoryRows = inventory.map((stock) => {
    const available = stock.onHand - stock.reserved,
      units = sold.get(`${stock.storeId}:${stock.variantId}`) ?? 0,
      recent = lastSold.get(`${stock.storeId}:${stock.variantId}`);
    return {
      id: stock.id,
      name: stock.variant.product.name,
      sku: stock.variant.sku,
      size: stock.variant.size,
      store: stock.store.name,
      kind: stock.store.kind,
      onHand: stock.onHand,
      reserved: stock.reserved,
      available,
      value: stock.variant.cost.mul(stock.onHand).toFixed(2),
      netUnitsSold: units,
      lowStock: available <= stock.reorderPoint,
      slowMoving:
        stock.onHand > 0 &&
        units === 0 &&
        stock.variant.product.createdAt < since,
      reorderSuggestion: Math.max(
        0,
        Math.max(stock.reorderPoint, Math.ceil((units / days) * 14)) -
          available,
      ),
      lastSaleInPeriod: recent ?? null,
    };
  });
  const valuation = inventory.reduce(
    (sum, row) => sum.plus(row.variant.cost.mul(row.onHand)),
    zero(),
  );
  const goodsNet = [...dimensions.products.values()].reduce(
    (sum, row) => sum.plus(row.revenue),
    zero(),
  );
  return {
    generatedAt: new Date(),
    days,
    currency: tenant.currency,
    scope: storeId ?? "ALL_LOCATIONS",
    sales: {
      grossSales: gross.toFixed(2),
      refunds: refunds.toFixed(2),
      netSales: net.toFixed(2),
      goodsNet: goodsNet.toFixed(2),
      orders: orders.length,
      averageOrder: orders.length ? net.div(orders.length).toFixed(2) : "0.00",
      grossMargin: allCosts ? goodsNet.minus(cost).toFixed(2) : null,
      costBasisComplete: allCosts,
      marginBasis:
        "Goods sales excluding tax and delivery, less captured variant costs. Historical missing costs suppress margin.",
    },
    dimensions: Object.fromEntries(
      Object.entries(dimensions).map(([key, map]) => [
        key,
        [...map.entries()]
          .map(([id, row]) => ({
            id,
            name: row.name,
            orders: row.orders.size,
            units: row.units,
            revenue: row.revenue.toFixed(2),
            grossMargin: row.costComplete
              ? row.revenue.minus(row.cost).toFixed(2)
              : null,
          }))
          .sort((a, b) => Number(b.revenue) - Number(a.revenue)),
      ]),
    ),
    inventory: {
      valuation: valuation.toFixed(2),
      basis:
        "Current variant cost; reorder suggestions use the selected sales period and 14 days of demand.",
      rows: inventoryRows,
      discrepancies: counts.reduce(
        (sum, row) => sum + Math.abs(row.difference),
        0,
      ),
      sizes: [...sizeUnits]
        .map(([size, units]) => ({ size, units }))
        .sort((a, b) => b.units - a.units),
    },
    loyalty: {
      members: accounts.length,
      pointsOutstanding: accounts.reduce((sum, a) => sum + a.points, 0),
      pointsEarned: entries
        .filter((e) => e.points > 0)
        .reduce((sum, e) => sum + e.points, 0),
      pointsRedeemed: entries
        .filter((e) => e.type === "REDEEM")
        .reduce((sum, e) => sum - e.points, 0),
      repeatMembers: accounts.filter((a) => a.customer.orders.length > 1)
        .length,
    },
    ai: jobs.map((row) => ({ status: row.status, count: row._count })),
    ecommerce: {
      conversionRate: null,
      cartAbandonment: null,
      attribution: null,
      reason:
        "Consent-based visitor and cart event tracking is not configured; order totals are available by channel.",
    },
  };
}
export function reportsRouter() {
  const router = express.Router();
  router.use("/reports", auth, tenantRequired, permit("OWNER", "MANAGER"));
  router.get("/reports", async (req, res) => {
    const input = z
      .object({
        days: z.coerce.number().int().min(1).max(366).default(30),
        storeId: z.string().optional(),
      })
      .parse(req.query);
    res.json(
      await businessReport(
        res.locals.actor.tenantId,
        input.days,
        input.storeId,
      ),
    );
  });
  return router;
}
