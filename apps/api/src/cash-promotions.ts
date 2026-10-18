import express from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { apiRateLimit } from "./rate-limits.js";
import { auth, tenantRequired, permit } from "./auth.js";
import { db } from "./db.js";
import { command, audit, lockTenant, type Actor } from "./retail.js";
import { HttpError, requireFound } from "./errors.js";
const amount = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/);
const manager = permit("OWNER", "MANAGER");
export function couponDiscount(
  coupon: {
    kind: string;
    value: Prisma.Decimal;
    minimum: Prisma.Decimal;
    channel: string;
    used: number;
    maximumUses: number;
    active: boolean;
    startsAt: Date;
    endsAt: Date;
  },
  subtotal: Prisma.Decimal,
  channel: string,
) {
  const now = new Date();
  if (
    !coupon.active ||
    coupon.startsAt > now ||
    coupon.endsAt <= now ||
    coupon.used >= coupon.maximumUses ||
    (coupon.channel !== "ALL" && coupon.channel !== channel)
  )
    throw new HttpError(
      422,
      "COUPON_UNAVAILABLE",
      "This promotion is unavailable for this purchase.",
    );
  if (subtotal.lte(0) || subtotal.lt(coupon.minimum))
    throw new HttpError(
      422,
      "COUPON_MINIMUM",
      "This basket is below the promotion’s minimum value.",
    );
  return Prisma.Decimal.min(
    subtotal,
    coupon.kind === "PERCENT"
      ? subtotal
          .mul(coupon.value)
          .div(100)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN)
      : coupon.value,
  );
}
export async function recordCash(
  tx: Prisma.TransactionClient,
  actor: Actor,
  storeId: string,
  value: Prisma.Decimal,
  type: "SALE" | "REFUND",
  orderId: string,
) {
  const session = await tx.cashSession.findFirst({
    where: { tenantId: actor.tenantId, storeId, closedAt: null },
  });
  if (!session) {
    const tenant = await tx.tenant.findUniqueOrThrow({
      where: { id: actor.tenantId },
      select: { requireCashSession: true },
    });
    if (tenant.requireCashSession)
      throw new HttpError(
        409,
        "REGISTER_CLOSED",
        "Open this store’s cash register before recording cash payments or refunds.",
      );
    return;
  }
  await writeCash(
    tx,
    actor,
    session.id,
    value,
    type,
    `${type.toLowerCase()} ${orderId}`,
    orderId,
  );
}
async function writeCash(
  tx: Prisma.TransactionClient,
  actor: Actor,
  sessionId: string,
  value: Prisma.Decimal,
  type: string,
  reason: string,
  orderId?: string,
) {
  const aggregate = await tx.cashMovement.aggregate({
      where: { tenantId: actor.tenantId, sessionId },
      _sum: { amount: true },
    }),
    balance = (aggregate._sum.amount ?? new Prisma.Decimal(0)).plus(value);
  if (balance.lt(0) || balance.gt("9999999999.99"))
    throw new HttpError(
      409,
      "CASH_BALANCE",
      "This movement exceeds the register’s available cash or supported balance.",
    );
  return tx.cashMovement.create({
    data: {
      tenantId: actor.tenantId,
      sessionId,
      orderId,
      actorId: actor.id,
      type,
      amount: value,
      reason,
    },
  });
}
const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,50}$/),
    name: z.string().min(2).max(100),
    kind: z.enum(["FIXED", "PERCENT"]),
    value: amount,
    minimum: amount.default("0"),
    channel: z.enum(["ALL", "POS", "ONLINE"]).default("ALL"),
    maximumUses: z.number().int().min(1).max(1000000),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .superRefine((v, ctx) => {
    if (Number(v.value) <= 0 || (v.kind === "PERCENT" && Number(v.value) > 100))
      ctx.addIssue({
        code: "custom",
        message: "Choose a positive value, up to 100 for a percentage.",
      });
    if (v.endsAt <= v.startsAt)
      ctx.addIssue({
        code: "custom",
        message: "The end must be after the start.",
      });
  });
export function cashPromotionsRouter() {
  const router = express.Router();
  router.use(
    ["/registers", "/coupons", "/cashier-report"],
    auth,
    tenantRequired,
  );
  router.get("/registers", async (req, res) => {
    const tenantId: string = res.locals.actor.tenantId,
      page = z.coerce
        .number()
        .int()
        .min(1)
        .parse(req.query.page ?? 1);
    const [tenant, items, total] = await Promise.all([
      db.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { requireCashSession: true },
      }),
      db.cashSession.findMany({
        where: { tenantId },
        include: { store: true },
        orderBy: { openedAt: "desc" },
        take: 25,
        skip: (page - 1) * 25,
      }),
      db.cashSession.count({ where: { tenantId } }),
    ]);
    res.json({ ...tenant, items, total });
  });
  router.put("/registers/config", manager, async (req, res) => {
    const { required } = z.object({ required: z.boolean() }).parse(req.body),
      actor: Actor = res.locals.actor;
    res.json(
      await db.$transaction(async (tx) => {
        await lockTenant(tx, actor.tenantId);
        const result = await tx.tenant.update({
          where: { id: actor.tenantId },
          data: { requireCashSession: required },
          select: { requireCashSession: true },
        });
        await audit(tx, actor, "REGISTER_POLICY", actor.tenantId, { required });
        return result;
      }),
    );
  });
  router.post("/registers/open", async (req, res) => {
    const input = z
        .object({ storeId: z.string().min(1), openingCash: amount })
        .parse(req.body),
      actor: Actor = res.locals.actor;
    res.status(201).json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "register-open", ...input },
        async (tx) => {
          requireFound(
            await tx.store.findFirst({
              where: {
                id: input.storeId,
                tenantId: actor.tenantId,
                kind: "STORE",
              },
            }),
          );
          if (
            await tx.cashSession.count({
              where: {
                tenantId: actor.tenantId,
                storeId: input.storeId,
                closedAt: null,
              },
            })
          )
            throw new HttpError(
              409,
              "REGISTER_OPEN",
              "This store already has an open cash register.",
            );
          const user = await tx.user.findUniqueOrThrow({
            where: { id: actor.id },
            select: { name: true },
          });
          const session = await tx.cashSession.create({
            data: {
              tenantId: actor.tenantId,
              storeId: input.storeId,
              activeStoreId: input.storeId,
              openedBy: actor.id,
              openedByName: user.name,
              openingCash: input.openingCash,
            },
          });
          await writeCash(
            tx,
            actor,
            session.id,
            new Prisma.Decimal(input.openingCash),
            "OPENING",
            "Opening float",
          );
          await audit(tx, actor, "REGISTER_OPENED", session.id, {
            openingCash: input.openingCash,
          });
          return session;
        },
      ),
    );
  });
  router.get("/registers/:id", async (req, res) => {
    const tenantId: string = res.locals.actor.tenantId,
      id = String(req.params.id),
      session = requireFound(
        await db.cashSession.findFirst({
          where: { tenantId, id },
          include: { store: true },
        }),
      );
    const [movements, aggregate] = await Promise.all([
      db.cashMovement.findMany({
        where: { tenantId, sessionId: id },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      db.cashMovement.aggregate({
        where: { tenantId, sessionId: id },
        _sum: { amount: true },
      }),
    ]);
    res.json({
      ...session,
      balance: aggregate._sum.amount ?? "0.00",
      movements,
    });
  });
  router.post("/registers/:id/movements", manager, async (req, res) => {
    const input = z
        .object({
          type: z.enum(["IN", "OUT"]),
          amount: amount,
          reason: z.string().min(3).max(1000),
        })
        .parse(req.body),
      actor: Actor = res.locals.actor,
      id = String(req.params.id);
    if (new Prisma.Decimal(input.amount).lte(0))
      throw new HttpError(422, "CASH_AMOUNT", "Choose a positive cash amount.");
    res.status(201).json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { operation: "register-movement", id, ...input },
        async (tx) => {
          requireFound(
            await tx.cashSession.findFirst({
              where: { tenantId: actor.tenantId, id, closedAt: null },
            }),
          );
          const movement = await writeCash(
            tx,
            actor,
            id,
            new Prisma.Decimal(input.amount).mul(input.type === "OUT" ? -1 : 1),
            input.type,
            input.reason,
          );
          await audit(tx, actor, "CASH_MOVEMENT", movement.id, {
            type: input.type,
            amount: input.amount,
          });
          return movement;
        },
      ),
    );
  });
  router.post("/registers/:id/close", async (req, res) => {
    const input = z
        .object({ countedCash: amount, note: z.string().max(1000).default("") })
        .parse(req.body),
      actor: Actor = res.locals.actor,
      id = String(req.params.id);
    res.json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "register-close", id, ...input },
        async (tx) => {
          const session = requireFound(
            await tx.cashSession.findFirst({
              where: { tenantId: actor.tenantId, id, closedAt: null },
            }),
          );
          if (actor.role === "CASHIER" && session.openedBy !== actor.id)
            throw new HttpError(
              403,
              "FORBIDDEN",
              "Only the opening cashier or a manager can close this register.",
            );
          const sums = await tx.cashMovement.aggregate({
              where: { tenantId: actor.tenantId, sessionId: id },
              _sum: { amount: true },
            }),
            expected = sums._sum.amount ?? new Prisma.Decimal(0),
            variance = new Prisma.Decimal(input.countedCash).minus(expected);
          const closed = await tx.cashSession.update({
            where: { id },
            data: {
              activeStoreId: null,
              closedAt: new Date(),
              closedBy: actor.id,
              countedCash: input.countedCash,
              expectedCash: expected,
              variance,
              closingNote: input.note,
            },
          });
          await audit(tx, actor, "REGISTER_CLOSED", id, {
            expected: expected.toString(),
            counted: input.countedCash,
            variance: variance.toString(),
          });
          return closed;
        },
      ),
    );
  });
  router.get("/cashier-report", manager, async (req, res) => {
    const tenantId: string = res.locals.actor.tenantId,
      from = z
        .string()
        .datetime()
        .parse(
          req.query.from ?? new Date(Date.now() - 30 * 86400000).toISOString(),
        );
    const [orders, users] = await Promise.all([
      db.order.groupBy({
        by: ["cashierId"],
        where: {
          tenantId,
          channel: "POS",
          createdAt: { gte: new Date(from) },
          status: { in: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] },
        },
        _sum: { total: true, refundedTotal: true },
        _count: { _all: true },
      }),
      db.user.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
    ]);
    const report = new Map<
      string,
      { cashierId: string; name: string; sales: number; net: Prisma.Decimal }
    >();
    for (const order of orders) {
      const row = report.get(order.cashierId) ?? {
        cashierId: order.cashierId,
        name:
          users.find((user) => user.id === order.cashierId)?.name ??
          "Earlier unassigned sales",
        sales: 0,
        net: new Prisma.Decimal(0),
      };
      row.sales = order._count._all;
      row.net = (order._sum.total ?? new Prisma.Decimal(0)).minus(
        order._sum.refundedTotal ?? 0,
      );
      report.set(order.cashierId, row);
    }
    res.json([...report.values()]);
  });
  router.get("/coupons", manager, async (_req, res) =>
    res.json(
      await db.coupon.findMany({
        where: { tenantId: res.locals.actor.tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ),
  );
  router.post("/coupons", manager, async (req, res) => {
    const input = couponSchema.parse(req.body),
      actor: Actor = res.locals.actor;
    res.status(201).json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "coupon-create", ...input },
        async (tx) => {
          if (
            await tx.coupon.count({
              where: { tenantId: actor.tenantId, code: input.code },
            })
          )
            throw new HttpError(
              409,
              "COUPON_EXISTS",
              "Choose another promotion code.",
            );
          const coupon = await tx.coupon.create({
            data: {
              ...input,
              startsAt: new Date(input.startsAt),
              endsAt: new Date(input.endsAt),
              tenantId: actor.tenantId,
            },
          });
          await audit(tx, actor, "COUPON_CREATED", coupon.id, {
            code: coupon.code,
          });
          return coupon;
        },
      ),
    );
  });
  router.patch("/coupons/:id", manager, async (req, res) => {
    const { active } = z.object({ active: z.boolean() }).parse(req.body),
      actor: Actor = res.locals.actor,
      id = String(req.params.id);
    res.json(
      await db.$transaction(async (tx) => {
        await lockTenant(tx, actor.tenantId);
        requireFound(
          await tx.coupon.findFirst({
            where: { tenantId: actor.tenantId, id },
          }),
        );
        const result = await tx.coupon.update({
          where: { id },
          data: { active },
        });
        await audit(tx, actor, "COUPON_STATUS", id, { active });
        return result;
      }),
    );
  });
  const preview = z.object({
    code: z.string().trim().toUpperCase().min(3).max(50),
    subtotal: amount,
    channel: z.enum(["POS", "ONLINE"]),
  });
  router.get("/coupons/quote", async (req, res) => {
    const input = preview.parse(req.query),
      coupon = requireFound(
        await db.coupon.findUnique({
          where: {
            tenantId_code: {
              tenantId: res.locals.actor.tenantId,
              code: input.code,
            },
          },
        }),
      );
    res.json({
      discount: couponDiscount(
        coupon,
        new Prisma.Decimal(input.subtotal),
        input.channel,
      ),
    });
  });
  router.get(
    "/storefront/:slug/coupon",
    apiRateLimit({ windowMs: 60000, limit: 30 }),
    async (req, res) => {
      const input = preview.parse({ ...req.query, channel: "ONLINE" }),
        tenant = requireFound(
          await db.tenant.findUnique({
            where: { slug: String(req.params.slug) },
            select: { id: true },
          }),
        ),
        coupon = requireFound(
          await db.coupon.findUnique({
            where: { tenantId_code: { tenantId: tenant.id, code: input.code } },
          }),
        );
      res.json({
        discount: couponDiscount(
          coupon,
          new Prisma.Decimal(input.subtotal),
          "ONLINE",
        ),
      });
    },
  );
  return router;
}
