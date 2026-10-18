import { createHash, randomUUID, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { requireFeature } from "./features.js";
import { db } from "./db.js";
import { HttpError, requireFound } from "./errors.js";
import type { CheckoutInput, ProductInput } from "@innovia/validation";
import type { Role } from "@innovia/types";
import { reconcileLoyalty } from "./loyalty.js";
import { createReturnInTransaction } from "./returns.js";
import { tokenHash } from "./customer-auth.js";
import { validateManagedMedia } from "./media.js";
import { requireSubscription } from "./subscription.js";
import { couponDiscount, recordCash } from "./cash-promotions.js";
export interface Actor {
  id: string;
  tenantId: string;
  role: Role;
}
type Tx = Prisma.TransactionClient;
export const productInclude = {
  variants: { include: { inventory: { include: { store: true } } } },
  media: { orderBy: { position: "asc" as const } },
} as const;
export const orderInclude = {
  items: true,
  store: true,
  returns: { include: { items: true } },
} as const;
export async function lockTenant(tx: Tx, tenantId: string) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM Tenant WHERE id = ${tenantId} FOR UPDATE`;
  requireFound(rows[0]);
}
export async function audit(
  tx: Tx,
  actor: Actor,
  action: string,
  entityId: string,
  details: Prisma.InputJsonValue,
) {
  await tx.auditLog.create({
    data: {
      tenantId: actor.tenantId,
      actorId: actor.id,
      action,
      entityId,
      details,
    },
  });
}
export async function command<T>(
  actor: Actor,
  key: string | undefined,
  payload: unknown,
  run: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!key || !/^[a-zA-Z0-9_-]{8,100}$/.test(key))
    throw new HttpError(
      400,
      "IDEMPOTENCY_REQUIRED",
      "Provide an Idempotency-Key of 8–100 letters, digits, underscores or hyphens.",
    );
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ actor: actor.id, payload }))
    .digest("hex");
  return db.$transaction(
    async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const previous = await tx.idempotentCommand.findUnique({
        where: { tenantId_key: { tenantId: actor.tenantId, key } },
      });
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new HttpError(
            409,
            "KEY_REUSED",
            "This request key was already used for a different operation.",
          );
        return previous.response as T;
      }
      const result = await run(tx);
      await tx.idempotentCommand.create({
        data: {
          tenantId: actor.tenantId,
          key,
          fingerprint,
          response: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
        },
      });
      return result;
    },
    { maxWait: 10000, timeout: 20000 },
  );
}
export async function createProduct(actor: Actor, input: ProductInput) {
  return db.$transaction(async (tx) => {
    await lockTenant(tx, actor.tenantId);
    return createProductInTransaction(tx, actor, input);
  });
}
export async function createProductInTransaction(
  tx: Tx,
  actor: Actor,
  input: ProductInput,
) {
  const tenant = requireFound(
    await tx.tenant.findUnique({
      where: { id: actor.tenantId },
      include: { plan: true },
    }),
  );
  if (
    (await tx.product.count({ where: { tenantId: actor.tenantId } })) >=
    tenant.plan.productLimit
  )
    throw new HttpError(
      403,
      "PLAN_LIMIT",
      "Your plan’s product limit has been reached.",
    );
  requireFound(
    await tx.store.findFirst({
      where: { tenantId: actor.tenantId, id: input.storeId },
    }),
  );
  const { variants, storeId, ...fields } = input;
  await requireSubscription(tx, actor.tenantId);
  await validateManagedMedia(tx, actor.tenantId, [input.imageUrl]);
  const product = await tx.product.create({
    data: { ...fields, tenantId: actor.tenantId },
  });
  for (const v of variants) {
    const { quantity, reorderPoint, ...data } = v;
    const variant = await tx.productVariant.create({
      data: { ...data, tenantId: actor.tenantId, productId: product.id },
    });
    await tx.inventory.create({
      data: {
        tenantId: actor.tenantId,
        variantId: variant.id,
        storeId,
        onHand: quantity,
        reorderPoint,
      },
    });
    if (quantity)
      await tx.stockMovement.create({
        data: {
          tenantId: actor.tenantId,
          variantId: variant.id,
          storeId,
          type: "OPENING",
          quantity,
          reason: "Initial product stock",
          actorId: actor.id,
        },
      });
  }
  await audit(tx, actor, "PRODUCT_CREATED", product.id, {
    name: product.name,
    variants: variants.length,
  });
  return tx.product.findUniqueOrThrow({
    where: { id: product.id },
    include: productInclude,
  });
}
export async function adjustStock(
  actor: Actor,
  input: {
    variantId: string;
    storeId: string;
    quantity: number;
    reason: string;
  },
  key?: string,
) {
  return command(actor, key, { type: "adjustment", ...input }, async (tx) => {
    requireFound(
      await tx.productVariant.findFirst({
        where: { id: input.variantId, tenantId: actor.tenantId },
      }),
    );
    requireFound(
      await tx.store.findFirst({
        where: { id: input.storeId, tenantId: actor.tenantId },
      }),
    );
    const stock = await tx.inventory.upsert({
      where: {
        tenantId_variantId_storeId: {
          tenantId: actor.tenantId,
          variantId: input.variantId,
          storeId: input.storeId,
        },
      },
      create: {
        tenantId: actor.tenantId,
        variantId: input.variantId,
        storeId: input.storeId,
      },
      update: {},
    });
    if (stock.onHand + input.quantity < stock.reserved)
      throw new HttpError(
        409,
        "INSUFFICIENT_STOCK",
        "The adjustment would reduce stock below the reserved quantity.",
      );
    const updated = await tx.inventory.update({
      where: { id: stock.id },
      data: { onHand: { increment: input.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        ...input,
        tenantId: actor.tenantId,
        actorId: actor.id,
        type: "ADJUSTMENT",
      },
    });
    await audit(tx, actor, "STOCK_ADJUSTED", stock.id, input);
    return updated;
  });
}
export async function checkout(
  actor: Actor,
  input: CheckoutInput,
  key?: string,
) {
  if (input.channel === "POS" && input.paymentMethod !== "CASH")
    throw new HttpError(
      400,
      "PAYMENT_UNAVAILABLE",
      "Only cash payments are currently configured for POS.",
    );
  if (input.channel === "ONLINE" && input.paymentMethod === "CASH")
    throw new HttpError(
      400,
      "PAYMENT_UNAVAILABLE",
      "Select cash on delivery or store pickup.",
    );
  return command(actor, key, { type: "checkout", ...input }, async (tx) => {
    return checkoutInTransaction(tx, actor, input);
  });
}
export async function checkoutInTransaction(
  tx: Tx,
  actor: Actor,
  input: CheckoutInput,
) {
  await requireSubscription(tx, actor.tenantId);
  if (input.channel === "ONLINE")
    await requireFeature(tx, actor.tenantId, "COMMERCE");
  const tenant = requireFound(
    await tx.tenant.findUnique({
      where: { id: actor.tenantId },
      select: {
        currency: true,
        taxRate: true,
        refundShipping: true,
        reservationMinutes: true,
      },
    }),
  );
  requireFound(
    await tx.store.findFirst({
      where: { tenantId: actor.tenantId, id: input.storeId, kind: "STORE" },
    }),
  );
  const quantities = new Map<string, number>();
  let shippingTotal = new Prisma.Decimal(0);
  if (input.paymentMethod === "CASH_ON_DELIVERY") {
    if (!input.deliveryZoneId || !input.shippingAddress)
      throw new HttpError(
        422,
        "DELIVERY_ADDRESS",
        "Select a delivery zone and provide a full Moroccan address.",
      );
    const zone = requireFound(
      await tx.deliveryZone.findFirst({
        where: {
          tenantId: actor.tenantId,
          id: input.deliveryZoneId,
          active: true,
        },
      }),
    );
    if (
      !Array.isArray(zone.cities) ||
      !zone.cities.some(
        (city) =>
          typeof city === "string" &&
          city.trim().toLowerCase() ===
            input.shippingAddress!.city.trim().toLowerCase(),
      )
    )
      throw new HttpError(
        422,
        "DELIVERY_CITY",
        "This city is not covered by the selected delivery zone.",
      );
    shippingTotal = zone.fee;
  }
  for (const item of input.items)
    quantities.set(
      item.variantId,
      (quantities.get(item.variantId) ?? 0) + item.quantity,
    );
  const lines: {
    variantId: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    costCaptured: boolean;
    discountTotal?: Prisma.Decimal;
  }[] = [];
  let total = new Prisma.Decimal(0);
  for (const [variantId, quantity] of quantities) {
    const variant = requireFound(
      await tx.productVariant.findFirst({
        where: {
          id: variantId,
          tenantId: actor.tenantId,
          product: { status: "ACTIVE" },
        },
        include: { product: true },
      }),
    );
    const stock = requireFound(
      await tx.inventory.findUnique({
        where: {
          tenantId_variantId_storeId: {
            tenantId: actor.tenantId,
            variantId,
            storeId: input.storeId,
          },
        },
      }),
      "This variant is unavailable at the selected store.",
    );
    if (stock.onHand - stock.reserved < quantity)
      throw new HttpError(
        409,
        "INSUFFICIENT_STOCK",
        `${variant.product.name} (${variant.size}) has insufficient available stock.`,
      );
    await tx.inventory.update({
      where: { id: stock.id },
      data:
        input.channel === "POS"
          ? { onHand: { decrement: quantity } }
          : { reserved: { increment: quantity } },
    });
    lines.push({
      variantId,
      name: variant.product.name,
      sku: variant.sku,
      quantity,
      unitPrice: variant.price,
      unitCost: variant.cost,
      costCaptured: true,
    });
    total = total.plus(variant.price.mul(quantity));
    await tx.stockMovement.create({
      data: {
        tenantId: actor.tenantId,
        variantId,
        storeId: input.storeId,
        actorId: actor.id,
        type: input.channel === "POS" ? "SALE" : "RESERVATION",
        quantity: -quantity,
        reason: `${input.channel} order`,
      },
    });
  }
  let customerId: string | undefined;
  if (total.gt("9999999999.99"))
    throw new HttpError(
      422,
      "ORDER_LIMIT",
      "This order exceeds the supported monetary limit.",
    );
  if (input.email) {
    const customer = await tx.customer.upsert({
      where: {
        tenantId_email: { tenantId: actor.tenantId, email: input.email },
      },
      create: {
        tenantId: actor.tenantId,
        name: input.customerName,
        email: input.email,
        phone: input.phone ?? "",
      },
      update: {},
    });
    customerId = customer.id;
  }
  let redemptionId: string | undefined;
  let couponId: string | undefined;
  let discountTotal = new Prisma.Decimal(0);
  if (input.rewardCode && input.couponCode)
    throw new HttpError(
      422,
      "DISCOUNT_COMBINATION",
      "Use one reward voucher or promotion per purchase.",
    );
  if (input.rewardCode) {
    const redemption = requireFound(
      await tx.rewardRedemption.findFirst({
        where: {
          tenantId: actor.tenantId,
          code: input.rewardCode,
          status: "ISSUED",
        },
        include: { account: { include: { customer: true } } },
      }),
      "This reward voucher is unavailable.",
    );
    if (redemption.account.customerId !== customerId)
      throw new HttpError(
        403,
        "REWARD_OWNER",
        "Use the email address associated with this membership.",
      );
    if (total.lt(redemption.discountValue))
      throw new HttpError(
        422,
        "REWARD_MINIMUM",
        "The basket must cover the full reward voucher value.",
      );
    discountTotal = redemption.discountValue;
    redemptionId = redemption.id;
    let assigned = new Prisma.Decimal(0);
    lines.forEach((line, index) => {
      line.discountTotal =
        index === lines.length - 1
          ? discountTotal.minus(assigned)
          : discountTotal
              .mul(line.unitPrice.mul(line.quantity))
              .div(total)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
      assigned = assigned.plus(line.discountTotal);
    });
    total = total.minus(discountTotal);
  }
  if (input.couponCode) {
    const coupon = requireFound(
      await tx.coupon.findUnique({
        where: {
          tenantId_code: { tenantId: actor.tenantId, code: input.couponCode },
        },
      }),
      "This promotion is unavailable.",
    );
    discountTotal = couponDiscount(coupon, total, input.channel);
    couponId = coupon.id;
    let assigned = new Prisma.Decimal(0);
    lines.forEach((line, index) => {
      line.discountTotal =
        index === lines.length - 1
          ? discountTotal.minus(assigned)
          : discountTotal
              .mul(line.unitPrice.mul(line.quantity))
              .div(total)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
      assigned = assigned.plus(line.discountTotal);
    });
    total = total.minus(discountTotal);
    await tx.coupon.update({
      where: { id: coupon.id },
      data: { used: { increment: 1 } },
    });
  }
  total = total.plus(shippingTotal);
  if (total.gt("9999999999.99"))
    throw new HttpError(
      422,
      "ORDER_LIMIT",
      "This order exceeds the supported amount.",
    );
  const trackingToken = randomBytes(32).toString("hex");
  const taxTotal = tenant.taxRate.isZero()
    ? new Prisma.Decimal(0)
    : total
        .mul(tenant.taxRate)
        .div(new Prisma.Decimal(100).plus(tenant.taxRate))
        .toDecimalPlaces(2);
  const order = await tx.order.create({
    data: {
      tenantId: actor.tenantId,
      storeId: input.storeId,
      customerId,
      customerName: input.customerName,
      cashierId: input.channel === "POS" ? actor.id : "",
      couponId,
      channel: input.channel,
      status: input.channel === "POS" ? "COMPLETED" : "PENDING",
      paymentMethod: input.paymentMethod,
      total,
      discountTotal,
      currency: tenant.currency,
      shippingTotal,
      taxTotal,
      taxRate: tenant.taxRate,
      refundShipping: tenant.refundShipping,
      ...(input.paymentMethod === "CASH_ON_DELIVERY"
        ? {
            shippingAddress: input.shippingAddress,
            deliveryZoneId: input.deliveryZoneId,
            deliveryStatus: "AWAITING_DISPATCH",
          }
        : {}),
      trackingTokenHash: tokenHash(trackingToken),
      reservationExpiresAt:
        input.channel === "ONLINE"
          ? new Date(Date.now() + tenant.reservationMinutes * 60000)
          : null,
      number: `INV-${randomUUID().slice(0, 8).toUpperCase()}`,
      items: { create: lines },
    },
    include: orderInclude,
  });
  if (redemptionId)
    await tx.rewardRedemption.update({
      where: { id: redemptionId },
      data: { status: "USED", orderId: order.id },
    });
  if (order.status === "COMPLETED") {
    await reconcileLoyalty(tx, actor, order.id);
    await recordCash(tx, actor, order.storeId, order.total, "SALE", order.id);
  }
  if (customerId)
    await tx.notification.create({
      data: {
        tenantId: actor.tenantId,
        customerId,
        title: `Order ${order.number}`,
        body:
          input.channel === "POS"
            ? "Thank you for your boutique purchase."
            : "Your order is reserved. Your boutique will arrange fulfilment.",
      },
    });
  await audit(tx, actor, "ORDER_CREATED", order.id, {
    channel: input.channel,
    total: total.toString(),
  });
  return { ...order, trackingToken };
}
export async function transitionOrder(
  actor: Actor,
  id: string,
  action: "complete" | "cancel" | "refund",
  key?: string,
) {
  return command(actor, key, { type: "transition", id, action }, async (tx) => {
    return transitionOrderInTransaction(tx, actor, id, action);
  });
}
export async function transitionOrderInTransaction(
  tx: Tx,
  actor: Actor,
  id: string,
  action: "complete" | "cancel" | "refund",
) {
  const order = requireFound(
    await tx.order.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { items: true },
    }),
  );
  const allowed =
    action === "refund"
      ? ["COMPLETED", "PARTIALLY_REFUNDED"].includes(order.status)
      : action === "complete"
        ? ["PENDING", "IN_FULFILMENT"].includes(order.status)
        : order.status === "PENDING";
  if (!allowed)
    throw new HttpError(
      409,
      "INVALID_TRANSITION",
      "This action is not available for the current order status.",
    );
  if (action === "refund") {
    await createReturnInTransaction(tx, actor, {
      orderId: id,
      reason: "Full manual cash reversal",
      items: order.items
        .filter((i) => i.returnedQuantity < i.quantity)
        .map((i) => ({
          orderItemId: i.id,
          quantity: i.quantity - i.returnedQuantity,
          restock: true,
        })),
    });
    return tx.order.findUniqueOrThrow({
      where: { id },
      include: orderInclude,
    });
  }
  for (const line of order.items) {
    if (order.status === "IN_FULFILMENT") continue;
    const stock = requireFound(
      await tx.inventory.findUnique({
        where: {
          tenantId_variantId_storeId: {
            tenantId: actor.tenantId,
            variantId: line.variantId,
            storeId: order.storeId,
          },
        },
      }),
    );
    await tx.inventory.update({
      where: { id: stock.id },
      data:
        action === "cancel"
          ? { reserved: { decrement: line.quantity } }
          : {
              reserved: { decrement: line.quantity },
              onHand: { decrement: line.quantity },
            },
    });
    await tx.stockMovement.create({
      data: {
        tenantId: actor.tenantId,
        variantId: line.variantId,
        storeId: order.storeId,
        actorId: actor.id,
        type: action.toUpperCase(),
        quantity: action === "complete" ? -line.quantity : line.quantity,
        reason: `${action} ${order.number}`,
      },
    });
  }
  const updated = await tx.order.update({
    where: { id: order.id },
    data: {
      reservationExpiresAt: null,
      deliveryStatus:
        action === "complete"
          ? order.paymentMethod === "CASH_ON_DELIVERY"
            ? "DELIVERED"
            : "COLLECTED"
          : "CANCELLED",
      status:
        action === "complete"
          ? "COMPLETED"
          : action === "cancel"
            ? "CANCELLED"
            : "REFUNDED",
    },
    include: orderInclude,
  });
  if (action === "complete") await reconcileLoyalty(tx, actor, order.id);
  if (action === "complete" && order.paymentMethod !== "CASH_ON_DELIVERY")
    await recordCash(tx, actor, order.storeId, order.total, "SALE", order.id);
  if (action === "cancel" && order.couponId)
    await tx.coupon.update({
      where: { id: order.couponId },
      data: { used: { decrement: 1 } },
    });
  if (action === "cancel")
    await tx.rewardRedemption.updateMany({
      where: { tenantId: actor.tenantId, orderId: order.id },
      data: { status: "ISSUED", orderId: null },
    });
  await audit(tx, actor, `ORDER_${action.toUpperCase()}`, id, {
    total: order.total.toString(),
  });
  if (order.customerId)
    await tx.notification.create({
      data: {
        tenantId: actor.tenantId,
        customerId: order.customerId,
        title: `Order ${order.number}`,
        body:
          action === "complete"
            ? "Your order has been completed."
            : "Your order has been cancelled.",
      },
    });
  return updated;
}
