import { Prisma } from "@prisma/client";
import { db } from "./db.js";
import { orderInclude } from "./retail.js";
export async function analytics(
  tenantId: string,
  days: number,
  storeId?: string,
) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - days + 1);
  const [orders, productCount, inventory, customerCount, recentOrders] =
    await Promise.all([
      db.order.findMany({
        where: {
          tenantId,
          status: { in: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] },
          createdAt: { gte: since },
          ...(storeId ? { storeId } : {}),
        },
        include: {
          items: { include: { variant: { include: { product: true } } } },
        },
      }),
      db.product.count({ where: { tenantId, status: { not: "ARCHIVED" } } }),
      db.inventory.findMany({
        where: { tenantId, ...(storeId ? { storeId } : {}) },
      }),
      db.customer.count({ where: { tenantId } }),
      db.order.findMany({
        where: { tenantId, ...(storeId ? { storeId } : {}) },
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);
  let revenue = new Prisma.Decimal(0);
  const daily = new Map<
    string,
    { date: string; amount: Prisma.Decimal; orders: number }
  >();
  for (let i = 0; i < days; i++) {
    const date = new Date(since);
    date.setUTCDate(date.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    daily.set(key, { date: key, amount: new Prisma.Decimal(0), orders: 0 });
  }
  const channels = new Map<
    string,
    { channel: string; amount: Prisma.Decimal; orders: number }
  >();
  const best = new Map<
    string,
    { name: string; imageUrl: string; quantity: number; amount: Prisma.Decimal }
  >();
  for (const order of orders) {
    const net = order.total.minus(order.refundedTotal);
    revenue = revenue.plus(net);
    const day = daily.get(order.createdAt.toISOString().slice(0, 10));
    if (day) {
      day.amount = day.amount.plus(net);
      day.orders++;
    }
    const channel = channels.get(order.channel) ?? {
      channel: order.channel,
      amount: new Prisma.Decimal(0),
      orders: 0,
    };
    channel.amount = channel.amount.plus(net);
    channel.orders++;
    channels.set(order.channel, channel);
    for (const item of order.items) {
      const entry = best.get(item.variant.productId) ?? {
        name: item.name,
        imageUrl: item.variant.product.imageUrl,
        quantity: 0,
        amount: new Prisma.Decimal(0),
      };
      entry.quantity += item.quantity - item.returnedQuantity;
      entry.amount = entry.amount.plus(
        item.unitPrice
          .mul(item.quantity)
          .minus(item.discountTotal)
          .minus(item.returnedAmount),
      );
      best.set(item.variant.productId, entry);
    }
  }
  return {
    revenue: revenue.toFixed(2),
    orders: orders.length,
    averageOrder: orders.length
      ? revenue.div(orders.length).toFixed(2)
      : "0.00",
    productCount,
    stockUnits: inventory.reduce((s, x) => s + x.onHand - x.reserved, 0),
    lowStock: inventory.filter((x) => x.onHand - x.reserved <= x.reorderPoint)
      .length,
    customerCount,
    daily: [...daily.values()].map((x) => ({
      date: x.date,
      revenue: x.amount.toNumber(),
      orders: x.orders,
    })),
    channels: [...channels.values()].map((x) => ({
      channel: x.channel,
      revenue: x.amount.toNumber(),
      orders: x.orders,
    })),
    bestSellers: [...best.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 4)
      .map((x) => ({
        name: x.name,
        imageUrl: x.imageUrl,
        quantity: x.quantity,
        revenue: x.amount.toNumber(),
      })),
    recentOrders,
  };
}
