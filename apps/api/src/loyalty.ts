import { Prisma } from "@prisma/client";
import { audit, type Actor } from "./retail.js";
import { randomBytes } from "node:crypto";
import { HttpError, requireFound } from "./errors.js";
import { reconcileReferral } from "./loyalty-bonuses.js";
import { requireFeature } from "./features.js";
type Tx = Prisma.TransactionClient;

export async function expirePoints(
  tx: Tx,
  tenantId: string,
  accountId: string,
) {
  const expired = await tx.loyaltyEntry.findMany({
    where: {
      tenantId,
      accountId,
      remaining: { gt: 0 },
      expiresAt: { lte: new Date() },
    },
  });
  for (const entry of expired) {
    await tx.loyaltyEntry.create({
      data: {
        tenantId,
        accountId,
        points: -entry.remaining,
        type: "EXPIRE",
        reason: `Expired lot ${entry.id}`,
        actorId: "system",
      },
    });
    await tx.loyaltyAccount.update({
      where: { id: accountId },
      data: { points: { decrement: entry.remaining } },
    });
    await tx.loyaltyEntry.update({
      where: { id: entry.id },
      data: { remaining: 0, expiredPoints: { increment: entry.remaining } },
    });
  }
}
export async function reconcileLoyalty(tx: Tx, actor: Actor, orderId: string) {
  const order = requireFound(
    await tx.order.findFirst({
      where: { id: orderId, tenantId: actor.tenantId },
    }),
  );
  if (
    !order.customerId ||
    !["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(order.status)
  )
    return;
  const account = await tx.loyaltyAccount.findUnique({
    where: {
      tenantId_customerId: {
        tenantId: actor.tenantId,
        customerId: order.customerId,
      },
    },
  });
  if (!account) return;
  if (account.enrolledAt > order.createdAt) return;
  const tenant = await tx.tenant.findUniqueOrThrow({
    where: { id: actor.tenantId },
    select: { plan: { select: { features: true } } },
  });
  if (
    order.loyaltyPoints === 0 &&
    order.status === "COMPLETED" &&
    Array.isArray(tenant.plan.features) &&
    !tenant.plan.features.includes("LOYALTY")
  )
    return;
  await reconcileReferral(tx, actor, orderId);
  await expirePoints(tx, actor.tenantId, account.id);
  const program = await tx.loyaltyProgram.findUnique({
    where: { tenantId: actor.tenantId },
    include: { tiers: { orderBy: { threshold: "desc" } } },
  });
  if (!program || (!program.enabled && order.loyaltyPoints === 0)) return;
  const earned = await tx.loyaltyEntry.findFirst({
    where: {
      tenantId: actor.tenantId,
      accountId: account.id,
      orderId,
      type: "EARN",
    },
  });
  if (!earned && order.status !== "COMPLETED") return;
  // Refunds use the original award and sale value; later rule/tier changes cannot change it.
  const originalAward = earned?.points;
  const multiplier =
    program.tiers.find((t) => account.lifetimePoints >= t.threshold)
      ?.multiplier ?? 1;
  const goodsTotal = order.total.minus(order.shippingTotal);
  const net = Prisma.Decimal.max(0, goodsTotal.minus(order.refundedTotal));
  const target =
    originalAward === undefined
      ? net
          .div(program.spendUnit)
          .floor()
          .mul(program.pointsPerUnit)
          .mul(multiplier)
          .toNumber()
      : goodsTotal.isZero()
        ? 0
        : net.mul(originalAward).div(goodsTotal).floor().toNumber();
  const delta = target - order.loyaltyPoints;
  if (!delta) {
    if (!earned)
      await tx.loyaltyEntry.create({
        data: {
          tenantId: actor.tenantId,
          accountId: account.id,
          orderId,
          points: 0,
          type: "EARN",
          reason: `${order.number}: zero-point award`,
          actorId: actor.id,
        },
      });
    return;
  }
  if (!Number.isSafeInteger(target) || target > 100000000)
    throw new HttpError(
      422,
      "LOYALTY_LIMIT",
      "The loyalty award exceeds the supported points limit.",
    );
  let applied = delta;
  if (delta < 0 && earned) {
    const expiredReversal = Math.min(-delta, earned.expiredPoints);
    applied += expiredReversal;
    await tx.loyaltyEntry.update({
      where: { id: earned.id },
      data: {
        remaining: Math.max(0, earned.remaining + delta),
        expiredPoints: earned.expiredPoints - expiredReversal,
      },
    });
  }
  await tx.loyaltyEntry.create({
    data: {
      tenantId: actor.tenantId,
      accountId: account.id,
      orderId,
      points: applied,
      remaining: applied > 0 ? applied : 0,
      type: delta > 0 ? "EARN" : "REFUND",
      reason: `${order.number}: ${delta > 0 ? "purchase award" : "refund reconciliation"}`,
      actorId: actor.id,
      expiresAt:
        delta > 0 && program.expiryDays > 0
          ? new Date(Date.now() + program.expiryDays * 86400000)
          : null,
    },
  });
  await tx.loyaltyAccount.update({
    where: { id: account.id },
    data: {
      points: { increment: applied },
      lifetimePoints: { increment: delta },
    },
  });
  await tx.order.update({
    where: { id: order.id },
    data: { loyaltyPoints: target },
  });
}
export async function consumePointLots(
  tx: Tx,
  tenantId: string,
  accountId: string,
  amount: number,
) {
  const lots = await tx.loyaltyEntry.findMany({
    where: { tenantId, accountId, remaining: { gt: 0 } },
    orderBy: { createdAt: "asc" },
  });
  let remaining = amount;
  for (const lot of lots) {
    const used = Math.min(lot.remaining, remaining);
    if (used)
      await tx.loyaltyEntry.update({
        where: { id: lot.id },
        data: { remaining: { decrement: used } },
      });
    remaining -= used;
    if (!remaining) break;
  }
  if (remaining)
    throw new HttpError(
      409,
      "LOYALTY_BALANCE",
      "The points ledger does not have sufficient redeemable points.",
    );
}

export async function redeemRewardInTransaction(
  tx: Tx,
  actor: Actor,
  input: { accountId: string; rewardId: string },
) {
  await requireFeature(tx, actor.tenantId, "LOYALTY");
  const account = requireFound(
    await tx.loyaltyAccount.findFirst({
      where: { tenantId: actor.tenantId, id: input.accountId },
    }),
  );
  const program = requireFound(
    await tx.loyaltyProgram.findUnique({ where: { tenantId: actor.tenantId } }),
  );
  if (!program.enabled)
    throw new HttpError(
      403,
      "LOYALTY_DISABLED",
      "This loyalty program is paused.",
    );
  const reward = requireFound(
    await tx.reward.findFirst({
      where: { tenantId: actor.tenantId, id: input.rewardId, active: true },
    }),
  );
  await expirePoints(tx, actor.tenantId, account.id);
  const current = await tx.loyaltyAccount.findUniqueOrThrow({
    where: { id: account.id },
  });
  if (current.points < reward.pointsCost)
    throw new HttpError(
      409,
      "LOYALTY_BALANCE",
      "This membership has insufficient points.",
    );
  await consumePointLots(tx, actor.tenantId, account.id, reward.pointsCost);
  await tx.loyaltyAccount.update({
    where: { id: account.id },
    data: { points: { decrement: reward.pointsCost } },
  });
  await tx.loyaltyEntry.create({
    data: {
      tenantId: actor.tenantId,
      accountId: account.id,
      points: -reward.pointsCost,
      type: "REDEEM",
      reason: reward.name,
      actorId: actor.id,
    },
  });
  const redemption = await tx.rewardRedemption.create({
    data: {
      tenantId: actor.tenantId,
      accountId: account.id,
      rewardId: reward.id,
      pointsCost: reward.pointsCost,
      discountValue: reward.discountValue,
      code: `RW-${randomBytes(12).toString("hex").toUpperCase()}`,
    },
  });
  await audit(tx, actor, "REWARD_REDEEMED", redemption.id, {
    pointsCost: reward.pointsCost,
  });
  return redemption;
}
