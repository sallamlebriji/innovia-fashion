import express from "express";
import { redeemRewardInTransaction } from "./loyalty.js";
import { z } from "zod";
import {
  loyaltyProgramSchema,
  rewardSchema,
  returnSchema,
} from "@innovia/validation";
import { db } from "./db.js";
import { auth, tenantRequired, permit } from "./auth.js";
import { command, audit, lockTenant, type Actor } from "./retail.js";
import { createReturnInTransaction } from "./returns.js";
import { expirePoints, consumePointLots } from "./loyalty.js";
import { requireFound } from "./errors.js";
import { customerDirectorySelect } from "./customer-auth.js";
const manager = permit("OWNER", "MANAGER");
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export function customerOperationsRouter() {
  const router = express.Router();
  router.use(["/returns", "/loyalty", "/rewards"], auth, tenantRequired);
  router.post("/returns", manager, async (req, res) => {
    const input = returnSchema.parse(req.body);
    res
      .status(201)
      .json(
        await command(
          res.locals.actor,
          req.get("Idempotency-Key"),
          { type: "return", ...input },
          (tx) => createReturnInTransaction(tx, res.locals.actor, input),
        ),
      );
  });
  router.get("/returns", async (req, res) => {
    const { page, limit } = pagination.parse(req.query),
      where = { tenantId: res.locals.actor.tenantId };
    const [items, total] = await Promise.all([
      db.returnRecord.findMany({
        where,
        include: {
          order: true,
          items: { include: { orderItem: true } },
          replacementOrder: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.returnRecord.count({ where }),
    ]);
    res.json({ items, total });
  });
  router.get("/loyalty", async (_req, res) => {
    const tenantId = res.locals.actor.tenantId;
    const [program, rewards, accounts, totals] = await Promise.all([
      db.loyaltyProgram.findUnique({
        where: { tenantId },
        include: { tiers: { orderBy: { threshold: "asc" } } },
      }),
      db.reward.findMany({
        where: { tenantId },
        orderBy: { pointsCost: "asc" },
      }),
      db.loyaltyAccount.count({ where: { tenantId } }),
      db.loyaltyEntry.groupBy({
        by: ["type"],
        where: { tenantId },
        _sum: { points: true },
        _count: { _all: true },
      }),
    ]);
    res.json({ program, rewards, accounts, totals });
  });
  router.get("/loyalty/voucher", async (req, res) => {
    const input = z
      .object({ code: z.string().min(8).max(100), email: z.string().email() })
      .parse(req.query);
    const voucher = requireFound(
      await db.rewardRedemption.findFirst({
        where: {
          tenantId: res.locals.actor.tenantId,
          code: input.code,
          status: "ISSUED",
          account: { customer: { email: input.email } },
        },
        select: { discountValue: true },
      }),
      "This voucher is unavailable for the supplied customer email.",
    );
    res.json(voucher);
  });
  router.put("/loyalty/program", manager, async (req, res) => {
    const { tiers, ...data } = loyaltyProgramSchema.parse(req.body),
      actor: Actor = res.locals.actor;
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const program = await tx.loyaltyProgram.upsert({
        where: { tenantId: actor.tenantId },
        create: { ...data, tenantId: actor.tenantId },
        update: data,
      });
      await tx.loyaltyTier.deleteMany({
        where: { tenantId: actor.tenantId, programId: program.id },
      });
      if (tiers.length)
        await tx.loyaltyTier.createMany({
          data: tiers.map((t) => ({
            ...t,
            tenantId: actor.tenantId,
            programId: program.id,
          })),
        });
      await audit(tx, actor, "LOYALTY_CONFIGURED", program.id, {
        enabled: data.enabled,
        tiers: tiers.length,
      });
      return tx.loyaltyProgram.findUniqueOrThrow({
        where: { id: program.id },
        include: { tiers: true },
      });
    });
    res.json(result);
  });
  router.get("/loyalty/accounts", async (req, res) => {
    const { page, limit } = pagination.parse(req.query),
      q = z
        .string()
        .max(100)
        .parse(req.query.q ?? ""),
      tenantId = res.locals.actor.tenantId;
    const where = {
      tenantId,
      ...(q
        ? {
            OR: [
              { cardCode: q },
              { customer: { name: { contains: q } } },
              { customer: { email: { contains: q } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.loyaltyAccount.findMany({
        where,
        include: { customer: { select: customerDirectorySelect } },
        orderBy: { enrolledAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.loyaltyAccount.count({ where }),
    ]);
    res.json({ items, total });
  });
  router.post("/loyalty/enroll", async (req, res) => {
    const input = z
        .object({ customerId: z.string().min(1), consent: z.literal(true) })
        .parse(req.body),
      actor: Actor = res.locals.actor;
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      requireFound(
        await tx.customer.findFirst({
          where: { tenantId: actor.tenantId, id: input.customerId },
        }),
      );
      const account = await tx.loyaltyAccount.upsert({
        where: {
          tenantId_customerId: {
            tenantId: actor.tenantId,
            customerId: input.customerId,
          },
        },
        create: {
          tenantId: actor.tenantId,
          customerId: input.customerId,
          consentAt: new Date(),
        },
        update: {},
      });
      await audit(tx, actor, "LOYALTY_ENROLLED", account.id, { consent: true });
      return account;
    });
    res.status(201).json(result);
  });
  router.get("/loyalty/accounts/:id", async (req, res) => {
    const actor: Actor = res.locals.actor;
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const account = requireFound(
        await tx.loyaltyAccount.findFirst({
          where: { tenantId: actor.tenantId, id: String(req.params.id) },
        }),
      );
      await expirePoints(tx, actor.tenantId, account.id);
      return tx.loyaltyAccount.findUniqueOrThrow({
        where: { id: account.id },
        include: {
          customer: { select: customerDirectorySelect },
          entries: { orderBy: { createdAt: "desc" }, take: 100 },
          redemptions: {
            include: { reward: true },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
      });
    });
    res.json(result);
  });
  router.post("/rewards", manager, async (req, res) => {
    const actor: Actor = res.locals.actor,
      data = rewardSchema.parse(req.body);
    const result = await db.$transaction(async (tx) => {
      const reward = await tx.reward.create({
        data: { ...data, tenantId: actor.tenantId },
      });
      await audit(tx, actor, "REWARD_CREATED", reward.id, {
        pointsCost: reward.pointsCost,
        discountValue: reward.discountValue.toString(),
      });
      return reward;
    });
    res.status(201).json(result);
  });
  router.patch("/rewards/:id", manager, async (req, res) => {
    const data = rewardSchema.partial().strict().parse(req.body),
      actor: Actor = res.locals.actor;
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const reward = requireFound(
        await tx.reward.findFirst({
          where: { tenantId: actor.tenantId, id: String(req.params.id) },
        }),
      );
      const updated = await tx.reward.update({
        where: { id: reward.id },
        data,
      });
      await audit(tx, actor, "REWARD_UPDATED", reward.id, {
        active: updated.active,
      });
      return updated;
    });
    res.json(result);
  });
  router.post("/loyalty/redeem", async (req, res) => {
    const input = z
        .object({ accountId: z.string().min(1), rewardId: z.string().min(1) })
        .parse(req.body),
      actor: Actor = res.locals.actor;
    res
      .status(201)
      .json(
        await command(
          actor,
          req.get("Idempotency-Key"),
          { type: "redeem", ...input },
          (tx) => redeemRewardInTransaction(tx, actor, input),
        ),
      );
  });
  router.post("/loyalty/adjust", manager, async (req, res) => {
    const input = z
        .object({
          accountId: z.string().min(1),
          points: z
            .number()
            .int()
            .min(-1000000)
            .max(1000000)
            .refine((v) => v !== 0),
          reason: z.string().min(3).max(500),
        })
        .parse(req.body),
      actor: Actor = res.locals.actor;
    res.json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "loyalty-adjust", ...input },
        async (tx) => {
          const account = requireFound(
            await tx.loyaltyAccount.findFirst({
              where: { tenantId: actor.tenantId, id: input.accountId },
            }),
          );
          await expirePoints(tx, actor.tenantId, account.id);
          if (input.points < 0)
            await consumePointLots(
              tx,
              actor.tenantId,
              account.id,
              -input.points,
            );
          await tx.loyaltyEntry.create({
            data: {
              tenantId: actor.tenantId,
              accountId: account.id,
              points: input.points,
              remaining: Math.max(0, input.points),
              type: "ADJUST",
              reason: input.reason,
              actorId: actor.id,
            },
          });
          const updated = await tx.loyaltyAccount.update({
            where: { id: account.id },
            data: { points: { increment: input.points } },
          });
          await audit(tx, actor, "LOYALTY_ADJUSTED", account.id, {
            points: input.points,
            reason: input.reason,
          });
          return updated;
        },
      ),
    );
  });
  return router;
}
