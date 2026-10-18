import { Prisma } from "@prisma/client";
import { type Actor } from "./retail.js";
export const moroccoDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export async function awardBirthday(
  tx: Prisma.TransactionClient,
  actor: Actor,
) {
  const customer = await tx.customer.findUnique({
      where: { id: actor.id },
      select: { birthday: true, loyaltyAccount: true },
    }),
    program = await tx.loyaltyProgram.findUnique({
      where: { tenantId: actor.tenantId },
    });
  if (
    !customer?.birthday ||
    !customer.loyaltyAccount ||
    !program?.enabled ||
    !program.birthdayPoints
  )
    return;
  const today = moroccoDate(),
    eventKey = `birthday-${today.slice(0, 4)}`,
    account = customer.loyaltyAccount;
  if (
    customer.birthday.toISOString().slice(5, 10) !== today.slice(5, 10) ||
    (await tx.loyaltyEntry.count({
      where: { tenantId: actor.tenantId, accountId: account.id, eventKey },
    }))
  )
    return;
  await tx.loyaltyEntry.create({
    data: {
      tenantId: actor.tenantId,
      accountId: account.id,
      points: program.birthdayPoints,
      remaining: program.birthdayPoints,
      eventKey,
      type: "BIRTHDAY",
      reason: "Annual birthday award",
      actorId: "system",
      expiresAt: program.expiryDays
        ? new Date(Date.now() + program.expiryDays * 86400000)
        : null,
    },
  });
  await tx.loyaltyAccount.update({
    where: { id: account.id },
    data: {
      points: { increment: program.birthdayPoints },
      lifetimePoints: { increment: program.birthdayPoints },
    },
  });
}
export async function reconcileReferral(
  tx: Prisma.TransactionClient,
  actor: Actor,
  orderId: string,
) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order?.customerId) return;
  const account = await tx.loyaltyAccount.findUnique({
    where: {
      tenantId_customerId: {
        tenantId: actor.tenantId,
        customerId: order.customerId,
      },
    },
  });
  if (!account?.referrerAccountId) return;
  const eventKey = `referral-${account.id}`,
    award = await tx.loyaltyEntry.findFirst({
      where: {
        tenantId: actor.tenantId,
        accountId: account.referrerAccountId,
        eventKey,
      },
    });
  if (account.referralOrderId && account.referralOrderId !== orderId) return;
  const goods = order.total.minus(order.shippingTotal),
    net = Prisma.Decimal.max(0, goods.minus(order.refundedTotal));
  if (!award) {
    if (order.status !== "COMPLETED") return;
    const program = await tx.loyaltyProgram.findUnique({
      where: { tenantId: actor.tenantId },
    });
    if (!program?.enabled || !program.referralPoints || net.lte(0)) return;
    await tx.loyaltyEntry.create({
      data: {
        tenantId: actor.tenantId,
        accountId: account.referrerAccountId,
        orderId,
        eventKey,
        points: program.referralPoints,
        remaining: program.referralPoints,
        type: "REFERRAL",
        reason: "A referred member’s first fulfilled purchase",
        actorId: actor.id,
        expiresAt: program.expiryDays
          ? new Date(Date.now() + program.expiryDays * 86400000)
          : null,
      },
    });
    await tx.loyaltyAccount.update({
      where: { id: account.referrerAccountId },
      data: {
        points: { increment: program.referralPoints },
        lifetimePoints: { increment: program.referralPoints },
      },
    });
    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { referralOrderId: orderId },
    });
    return;
  }
  const entries = await tx.loyaltyEntry.aggregate({
    where: {
      tenantId: actor.tenantId,
      accountId: account.referrerAccountId,
      orderId,
      type: "REFERRAL_REVERSAL",
    },
    _sum: { points: true, expiredPoints: true },
  });
  const target = goods.isZero()
      ? 0
      : net.mul(award.points).div(goods).floor().toNumber(),
    delta =
      target -
      (award.points +
        (entries._sum.points ?? 0) -
        (entries._sum.expiredPoints ?? 0));
  if (delta >= 0) return;
  const expiredReversal = Math.min(-delta, award.expiredPoints),
    applied = delta + expiredReversal;
  await tx.loyaltyEntry.update({
    where: { id: award.id },
    data: {
      remaining: Math.max(0, award.remaining + delta),
      expiredPoints: award.expiredPoints - expiredReversal,
    },
  });
  await tx.loyaltyEntry.create({
    data: {
      tenantId: actor.tenantId,
      accountId: account.referrerAccountId,
      orderId,
      points: applied,
      expiredPoints: expiredReversal,
      type: "REFERRAL_REVERSAL",
      reason: "Referred purchase refund",
      actorId: actor.id,
    },
  });
  await tx.loyaltyAccount.update({
    where: { id: account.referrerAccountId },
    data: {
      points: { increment: applied },
      lifetimePoints: { increment: delta },
    },
  });
}
