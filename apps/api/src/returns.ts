import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { returnSchema } from "@innovia/validation";
import { audit, checkoutInTransaction, type Actor } from "./retail.js";
import { reconcileLoyalty } from "./loyalty.js";
import { HttpError, requireFound } from "./errors.js";
import { recordCash } from "./cash-promotions.js";

export async function createReturnInTransaction(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: z.infer<typeof returnSchema>,
) {
  const order = requireFound(
    await tx.order.findFirst({
      where: { id: input.orderId, tenantId: actor.tenantId },
      include: { items: true, customer: true },
    }),
  );
  if (!["COMPLETED", "PARTIALLY_REFUNDED"].includes(order.status))
    throw new HttpError(
      409,
      "INVALID_RETURN",
      "Only fulfilled sales with remaining units can be returned.",
    );
  if (
    new Set(input.items.map((i) => i.orderItemId)).size !== input.items.length
  )
    throw new HttpError(
      422,
      "DUPLICATE_LINE",
      "Each return line may appear once.",
    );
  let total = new Prisma.Decimal(0);
  const returnItems: {
    orderItemId: string;
    quantity: number;
    restock: boolean;
    amount: Prisma.Decimal;
  }[] = [];
  for (const item of input.items) {
    const line = requireFound(
      order.items.find((i) => i.id === item.orderItemId),
    );
    if (item.quantity > line.quantity - line.returnedQuantity)
      throw new HttpError(
        409,
        "RETURN_QUANTITY",
        "The requested units have already been returned or exceed the sale.",
      );
    const charged = line.unitPrice.mul(line.quantity).minus(line.discountTotal);
    const amount =
      item.quantity === line.quantity - line.returnedQuantity
        ? charged.minus(line.returnedAmount)
        : charged
            .mul(item.quantity)
            .div(line.quantity)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
    total = total.plus(amount);
    returnItems.push({ ...item, amount });
    await tx.orderItem.update({
      where: { id: line.id },
      data: {
        returnedQuantity: { increment: item.quantity },
        returnedAmount: { increment: amount },
      },
    });
    if (item.restock) {
      const identity = {
        tenantId: actor.tenantId,
        variantId: line.variantId,
        storeId: order.storeId,
      };
      await tx.inventory.upsert({
        where: { tenantId_variantId_storeId: identity },
        create: { ...identity, onHand: item.quantity },
        update: { onHand: { increment: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          ...identity,
          quantity: item.quantity,
          type: "RETURN",
          reason: `${order.number}: ${input.reason}`,
          actorId: actor.id,
        },
      });
    }
  }
  const remaining = await tx.orderItem.count({
    where: {
      tenantId: actor.tenantId,
      orderId: order.id,
      NOT: { returnedQuantity: { equals: 0 } },
    },
  });
  // Compare actual quantities rather than amounts: a fully discounted sale can have a zero refund.
  const lines = await tx.orderItem.findMany({
    where: { tenantId: actor.tenantId, orderId: order.id },
  });
  const fullyReturned = lines.every((i) => i.returnedQuantity === i.quantity);
  if (fullyReturned && order.refundShipping)
    total = total.plus(order.shippingTotal);
  await tx.order.update({
    where: { id: order.id },
    data: {
      refundedTotal: { increment: total },
      status: fullyReturned ? "REFUNDED" : "PARTIALLY_REFUNDED",
    },
  });
  await reconcileLoyalty(tx, actor, order.id);
  if (fullyReturned) {
    const reward = await tx.rewardRedemption.findFirst({
      where: { tenantId: actor.tenantId, orderId: order.id, status: "USED" },
    });
    if (reward) {
      await tx.loyaltyEntry.create({
        data: {
          tenantId: actor.tenantId,
          accountId: reward.accountId,
          orderId: order.id,
          points: reward.pointsCost,
          remaining: reward.pointsCost,
          type: "REWARD_REFUND",
          reason: "Reward restored after full return",
          actorId: actor.id,
        },
      });
      await tx.loyaltyAccount.update({
        where: { id: reward.accountId },
        data: { points: { increment: reward.pointsCost } },
      });
      await tx.rewardRedemption.update({
        where: { id: reward.id },
        data: { status: "REFUNDED" },
      });
    }
  }
  let replacementOrderId: string | undefined,
    cashDifference = total.negated();
  if (input.replacementItems) {
    const replacement = await checkoutInTransaction(tx, actor, {
      storeId: order.storeId,
      customerName: order.customerName,
      ...(order.customer
        ? {
            email: order.customer.email,
            ...(order.customer.phone ? { phone: order.customer.phone } : {}),
          }
        : {}),
      channel: "POS",
      paymentMethod: "CASH",
      items: input.replacementItems,
    });
    replacementOrderId = replacement.id;
    cashDifference = replacement.total.minus(total);
  }
  if (
    input.expectedCashDifference !== undefined &&
    !cashDifference.equals(input.expectedCashDifference)
  )
    throw new HttpError(
      409,
      "RETURN_PRICE_CHANGED",
      "The cash amount has changed. Refresh the order and replacement prices before recording the exchange.",
    );
  const record = await tx.returnRecord.create({
    data: {
      tenantId: actor.tenantId,
      orderId: order.id,
      replacementOrderId,
      reason: input.reason,
      actorId: actor.id,
      total,
      cashDifference,
      items: { create: returnItems },
    },
    include: { items: true, replacementOrder: true },
  });
  if (order.paymentMethod !== "CASH_ON_DELIVERY")
    await recordCash(
      tx,
      actor,
      order.storeId,
      total.negated(),
      "REFUND",
      order.id,
    );
  await audit(
    tx,
    actor,
    replacementOrderId ? "EXCHANGE_CREATED" : "RETURN_CREATED",
    record.id,
    {
      orderId: order.id,
      total: total.toString(),
      cashDifference: cashDifference.toString(),
      returnedLines: remaining,
    },
  );
  return record;
}
