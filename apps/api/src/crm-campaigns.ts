import express from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth, tenantRequired, permit } from "./auth.js";
import { db } from "./db.js";
import { command, audit, lockTenant, type Actor } from "./retail.js";
import { requireFound } from "./errors.js";
import { customerProfileSelect, customerOrderSelect } from "./customer-auth.js";
const fulfilled = ["COMPLETED", "PARTIALLY_REFUNDED"] as const;
const segments = z.enum(["ALL", "MEMBERS", "REPEAT", "LAPSED"]);
const preferencesSchema = z.object({
  sizes: z.array(z.string().min(1).max(20)).max(10),
  categories: z.array(z.string().min(1).max(80)).max(10),
  preferredStoreId: z.string().nullable(),
});
export async function validatePreferences(
  tx: Prisma.TransactionClient,
  tenantId: string,
  value: unknown,
) {
  const data = preferencesSchema.parse(value);
  if (data.preferredStoreId)
    requireFound(
      await tx.store.findFirst({
        where: { tenantId, id: data.preferredStoreId, kind: "STORE" },
      }),
    );
  return data;
}
const campaignSchema = z.object({
  name: z.string().min(2).max(100),
  title: z.string().min(2).max(160),
  body: z.string().min(5).max(2000),
  segment: segments,
  scheduledAt: z.string().datetime().nullable().default(null),
});
export async function runCampaigns() {
  const campaigns = await db.campaign.findMany({
    where: {
      status: { in: ["SCHEDULED", "PUBLISHING"] },
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  for (const candidate of campaigns)
    await db.$transaction(
      async (tx) => {
        await lockTenant(tx, candidate.tenantId);
        const campaign = await tx.campaign.findUniqueOrThrow({
          where: { id: candidate.id },
        });
        if (
          !["SCHEDULED", "PUBLISHING"].includes(campaign.status) ||
          (campaign.scheduledAt && campaign.scheduledAt > new Date())
        )
          return;
        const publishedAt = campaign.publishedAt ?? new Date();
        const customers = await tx.customer.findMany({
          where: {
            tenantId: campaign.tenantId,
            id: { gt: campaign.lastCustomerId },
            createdAt: { lte: publishedAt },
            passwordHash: { not: null },
          },
          select: {
            id: true,
            loyaltyAccount: { select: { id: true } },
            consents: {
              where: { purpose: "IN_APP_MARKETING", granted: true },
              select: { id: true },
            },
            _count: {
              select: { orders: { where: { status: { in: [...fulfilled] } } } },
            },
            orders: {
              where: { status: { in: [...fulfilled] } },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
          },
          orderBy: { id: "asc" },
          take: 100,
        });
        let sent = 0;
        for (const customer of customers) {
          const eligible =
            campaign.segment === "ALL" ||
            (campaign.segment === "MEMBERS" && !!customer.loyaltyAccount) ||
            (campaign.segment === "REPEAT" && customer._count.orders >= 2) ||
            (campaign.segment === "LAPSED" &&
              !!customer.orders[0] &&
              customer.orders[0].createdAt <
                new Date(Date.now() - 90 * 86400000));
          if (!eligible || !customer.consents.length) continue;
          const where = {
            tenantId: campaign.tenantId,
            campaignId: campaign.id,
            customerId: customer.id,
          };
          if (await tx.campaignDelivery.count({ where })) continue;
          await tx.campaignDelivery.create({ data: where });
          await tx.notification.create({
            data: {
              tenantId: campaign.tenantId,
              customerId: customer.id,
              title: campaign.title,
              kind: "MARKETING",
              body: campaign.body,
              channel: "IN_APP",
            },
          });
          sent++;
        }
        await tx.campaign.update({
          where: { id: campaign.id },
          data: {
            publishedAt,
            status: customers.length < 100 ? "SENT" : "PUBLISHING",
            lastCustomerId: customers.at(-1)?.id ?? campaign.lastCustomerId,
          },
        });
        await audit(
          tx,
          { tenantId: campaign.tenantId, id: "system", role: "OWNER" },
          "CAMPAIGN_BATCH",
          campaign.id,
          { sent, scanned: customers.length, channel: "IN_APP" },
        );
      },
      { timeout: 20000 },
    );
}
export function crmCampaignsRouter() {
  const router = express.Router();
  router.use(
    ["/crm", "/campaigns"],
    auth,
    tenantRequired,
    permit("OWNER", "MANAGER"),
  );
  router.get("/crm/customers/:id", async (req, res) => {
    const tenantId: string = res.locals.actor.tenantId,
      id = String(req.params.id),
      page = z.coerce
        .number()
        .int()
        .min(1)
        .parse(req.query.page ?? 1),
      customer = requireFound(
        await db.customer.findFirst({
          where: { tenantId, id },
          select: {
            ...customerProfileSelect,
            notes: true,
            consents: {
              select: { purpose: true, granted: true, updatedAt: true },
            },
            loyaltyAccount: {
              include: {
                redemptions: {
                  include: { reward: { select: { name: true } } },
                  orderBy: { createdAt: "desc" },
                  take: 20,
                },
              },
            },
          },
        }),
      );
    const where = {
      tenantId,
      customerId: id,
      status: {
        in: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] as (
          "COMPLETED" | "PARTIALLY_REFUNDED" | "REFUNDED"
        )[],
      },
    };
    const [summary, stores, orders, total] = await Promise.all([
      db.order.aggregate({
        where,
        _sum: { total: true, refundedTotal: true },
        _count: true,
      }),
      db.order.groupBy({
        by: ["storeId"],
        where,
        _count: true,
        _sum: { total: true, refundedTotal: true },
      }),
      db.order.findMany({
        where: { tenantId, customerId: id },
        select: customerOrderSelect,
        orderBy: { createdAt: "desc" },
        take: 24,
        skip: (page - 1) * 24,
      }),
      db.order.count({ where: { tenantId, customerId: id } }),
    ]);
    const retainedPurchases = await db.order.count({
      where: { tenantId, customerId: id, status: { in: [...fulfilled] } },
    });
    const storeNames = await db.store.findMany({
      where: { tenantId, id: { in: stores.map((store) => store.storeId) } },
      select: { id: true, name: true },
    });
    res.json({
      customer,
      summary: {
        fulfilledPurchases: retainedPurchases,
        repeat: retainedPurchases >= 2,
        lifetimeNetSales: (summary._sum.total ?? new Prisma.Decimal(0)).minus(
          summary._sum.refundedTotal ?? 0,
        ),
        estimateMethod:
          "Recorded fulfilled sales less refunds; this is historical value, not a prediction.",
        stores: stores.map((store) => ({
          ...store,
          name:
            storeNames.find((item) => item.id === store.storeId)?.name ??
            "Boutique",
        })),
      },
      orders: { items: orders, total },
    });
  });
  router.patch("/crm/customers/:id", async (req, res) => {
    const { notes } = z.object({ notes: z.string().max(2000) }).parse(req.body),
      actor: Actor = res.locals.actor,
      id = String(req.params.id);
    res.json(
      await db.$transaction(async (tx) => {
        await lockTenant(tx, actor.tenantId);
        requireFound(
          await tx.customer.findFirst({
            where: { tenantId: actor.tenantId, id },
          }),
        );
        await tx.customer.update({ where: { id }, data: { notes } });
        await audit(tx, actor, "CUSTOMER_NOTES_UPDATED", id, {});
        return { ok: true };
      }),
    );
  });
  router.get("/campaigns", async (req, res) => {
    const tenantId: string = res.locals.actor.tenantId,
      page = z.coerce
        .number()
        .int()
        .min(1)
        .parse(req.query.page ?? 1);
    const [items, total] = await Promise.all([
      db.campaign.findMany({
        where: { tenantId },
        include: { _count: { select: { deliveries: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 24,
        take: 24,
      }),
      db.campaign.count({ where: { tenantId } }),
    ]);
    res.json({ items, total });
  });
  router.post("/campaigns", async (req, res) => {
    const input = campaignSchema.parse(req.body),
      actor: Actor = res.locals.actor;
    res.status(201).json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "campaign-create", ...input },
        async (tx) => {
          const campaign = await tx.campaign.create({
            data: {
              ...input,
              tenantId: actor.tenantId,
              scheduledAt: input.scheduledAt
                ? new Date(input.scheduledAt)
                : null,
            },
          });
          await audit(tx, actor, "CAMPAIGN_CREATED", campaign.id, {
            segment: input.segment,
          });
          return campaign;
        },
      ),
    );
  });
  router.post("/campaigns/:id/publish", async (req, res) => {
    const actor: Actor = res.locals.actor,
      id = String(req.params.id);
    res.json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "campaign-publish", id },
        async (tx) => {
          requireFound(
            await tx.campaign.findFirst({
              where: { tenantId: actor.tenantId, id, status: "DRAFT" },
            }),
          );
          const campaign = await tx.campaign.update({
            where: { id },
            data: { status: "SCHEDULED" },
          });
          await audit(tx, actor, "CAMPAIGN_SCHEDULED", id, {});
          return campaign;
        },
      ),
    );
  });
  router.post("/campaigns/:id/cancel", async (req, res) => {
    const actor: Actor = res.locals.actor,
      id = String(req.params.id);
    res.json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "campaign-cancel", id },
        async (tx) => {
          requireFound(
            await tx.campaign.findFirst({
              where: {
                tenantId: actor.tenantId,
                id,
                status: { in: ["DRAFT", "SCHEDULED", "PUBLISHING"] },
              },
            }),
          );
          const campaign = await tx.campaign.update({
            where: { id },
            data: { status: "CANCELLED" },
          });
          await audit(tx, actor, "CAMPAIGN_CANCELLED", id, {});
          return campaign;
        },
      ),
    );
  });
  return router;
}
