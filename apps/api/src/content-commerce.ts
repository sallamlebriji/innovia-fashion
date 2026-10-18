import express from "express";
import { validateManagedMedia } from "./media.js";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  cmsPageSchema,
  commerceSettingsSchema,
  deliveryZoneSchema,
} from "@innovia/validation";
import { auth, tenantRequired, permit } from "./auth.js";
import { db } from "./db.js";
import { command, audit, lockTenant, type Actor } from "./retail.js";
import { HttpError, requireFound } from "./errors.js";
import { tokenHash } from "./customer-auth.js";

export const commerceSelect = {
  taxRate: true,
  refundShipping: true,
  reservationMinutes: true,
  legalName: true,
  invoiceAddress: true,
  taxIdentifier: true,
  contactEmail: true,
  contactPhone: true,
  returnPolicy: true,
  deliveryPolicy: true,
} as const;
export function signPreview(tenantId: string) {
  const secret = process.env.APP_SIGNING_SECRET;
  if (!secret || secret.length < 32)
    throw new HttpError(
      503,
      "PREVIEW_CONFIG",
      "Configure APP_SIGNING_SECRET to enable private previews.",
    );
  const payload = Buffer.from(
    JSON.stringify({
      tenantId,
      expires: Date.now() + 600000,
      nonce: randomBytes(12).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function verifyPreview(token: string, tenantId: string) {
  const secret = process.env.APP_SIGNING_SECRET,
    [payload, signature] = token.split(".");
  if (!secret || !payload || !signature || token.length > 1000) return false;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (
    expected.length !== signature.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  )
    return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.tenantId === tenantId && data.expires > Date.now();
  } catch {
    return false;
  }
}
export function liveContent(published: Prisma.JsonValue | null) {
  const parsed = cmsPageSchema.safeParse(published);
  if (!parsed.success) return null;
  const now = new Date().toISOString();
  return {
    ...parsed.data,
    sections: parsed.data.sections.filter(
      (s) =>
        s.active &&
        (!s.startsAt || s.startsAt <= now) &&
        (!s.endsAt || s.endsAt > now),
    ),
  };
}
export function contentCommerceRouter() {
  const router = express.Router(),
    manager = permit("OWNER", "MANAGER");
  router.use(
    ["/cms", "/commerce", "/orders/:id/delivery"],
    auth,
    tenantRequired,
  );
  router.get("/commerce", async (_req, res) => {
    const tenantId: string = res.locals.actor.tenantId;
    const [settings, zones] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId }, select: commerceSelect }),
      db.deliveryZone.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
      }),
    ]);
    res.json({ settings, zones });
  });
  router.put("/commerce/settings", manager, async (req, res) => {
    const data = commerceSettingsSchema.parse(req.body),
      actor: Actor = res.locals.actor;
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const updated = await tx.tenant.update({
        where: { id: actor.tenantId },
        data,
        select: commerceSelect,
      });
      await audit(tx, actor, "COMMERCE_CONFIGURED", actor.tenantId, {
        taxRate: data.taxRate,
        reservationMinutes: data.reservationMinutes,
      });
      return updated;
    });
    res.json(result);
  });
  router.post("/commerce/zones", manager, async (req, res) => {
    const data = deliveryZoneSchema.parse(req.body),
      actor: Actor = res.locals.actor;
    const result = await db.$transaction(async (tx) => {
      const zone = await tx.deliveryZone.create({
        data: { ...data, tenantId: actor.tenantId },
      });
      await audit(tx, actor, "DELIVERY_ZONE_CREATED", zone.id, {
        name: zone.name,
        fee: zone.fee.toString(),
      });
      return zone;
    });
    res.status(201).json(result);
  });
  router.patch("/commerce/zones/:id", manager, async (req, res) => {
    const data = deliveryZoneSchema.partial().strict().parse(req.body),
      actor: Actor = res.locals.actor;
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const zone = requireFound(
        await tx.deliveryZone.findFirst({
          where: { tenantId: actor.tenantId, id: String(req.params.id) },
        }),
      );
      const updated = await tx.deliveryZone.update({
        where: { id: zone.id },
        data,
      });
      await audit(tx, actor, "DELIVERY_ZONE_UPDATED", zone.id, {
        active: updated.active,
      });
      return updated;
    });
    res.json(result);
  });
  router.get("/cms", async (_req, res) =>
    res.json(
      await db.cMSPage.findUnique({
        where: {
          tenantId_slug: { tenantId: res.locals.actor.tenantId, slug: "home" },
        },
        include: { sections: { orderBy: { position: "asc" } } },
      }),
    ),
  );
  router.put("/cms", manager, async (req, res) => {
    const { sections, ...data } = cmsPageSchema.parse(req.body),
      actor: Actor = res.locals.actor;
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      await validateManagedMedia(tx, actor.tenantId, [
        ...sections.map((section) => section.imageUrl),
        data.design.logoUrl,
        data.design.faviconUrl,
      ]);
      const page = await tx.cMSPage.upsert({
        where: { tenantId_slug: { tenantId: actor.tenantId, slug: "home" } },
        create: { ...data, tenantId: actor.tenantId },
        update: data,
      });
      await tx.cMSSection.deleteMany({
        where: { tenantId: actor.tenantId, pageId: page.id },
      });
      if (sections.length)
        await tx.cMSSection.createMany({
          data: sections.map((s, position) => ({
            ...s,
            position,
            tenantId: actor.tenantId,
            pageId: page.id,
            startsAt: s.startsAt ? new Date(s.startsAt) : null,
            endsAt: s.endsAt ? new Date(s.endsAt) : null,
          })),
        });
      await audit(tx, actor, "CMS_DRAFT_SAVED", page.id, {
        sections: sections.length,
      });
      return tx.cMSPage.findUniqueOrThrow({
        where: { id: page.id },
        include: { sections: { orderBy: { position: "asc" } } },
      });
    });
    res.json(result);
  });
  router.post("/cms/publish", manager, async (_req, res) => {
    const actor: Actor = res.locals.actor;
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const page = requireFound(
        await tx.cMSPage.findUnique({
          where: { tenantId_slug: { tenantId: actor.tenantId, slug: "home" } },
          include: { sections: { orderBy: { position: "asc" } } },
        }),
      );
      const snapshot = cmsPageSchema.parse({
        ...page,
        sections: page.sections.map((s) => ({
          ...s,
          startsAt: s.startsAt?.toISOString() ?? null,
          endsAt: s.endsAt?.toISOString() ?? null,
        })),
      });
      const updated = await tx.cMSPage.update({
        where: { id: page.id },
        data: { published: snapshot, publishedAt: new Date() },
      });
      await audit(tx, actor, "CMS_PUBLISHED", page.id, {
        sections: snapshot.sections.length,
      });
      return updated;
    });
    res.json(result);
  });
  router.post("/cms/preview", manager, async (_req, res) => {
    const tenant = requireFound(
      await db.tenant.findUnique({
        where: { id: res.locals.actor.tenantId },
        select: { id: true, slug: true },
      }),
    );
    res.json({
      url: `${process.env.STOREFRONT_ORIGIN ?? "http://localhost:3000"}/${tenant.slug}?preview=${encodeURIComponent(signPreview(tenant.id))}`,
    });
  });
  router.post("/orders/:id/delivery", manager, async (req, res) => {
    const input = z
        .object({
          status: z.enum(["SHIPPED", "RETURNED"]),
          carrier: z.string().max(100).default(""),
          trackingNumber: z.string().max(150).default(""),
        })
        .parse(req.body),
      actor: Actor = res.locals.actor,
      id = String(req.params.id);
    res.json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "delivery", id, ...input },
        async (tx) => {
          const order = requireFound(
            await tx.order.findFirst({
              where: { tenantId: actor.tenantId, id },
              include: { items: true },
            }),
          );
          if (
            order.paymentMethod !== "CASH_ON_DELIVERY" ||
            (input.status === "SHIPPED"
              ? order.status !== "PENDING"
              : order.status !== "IN_FULFILMENT")
          )
            throw new HttpError(
              409,
              "DELIVERY_STATE",
              "This delivery transition is not available.",
            );
          for (const item of order.items) {
            const stock = requireFound(
              await tx.inventory.findUnique({
                where: {
                  tenantId_variantId_storeId: {
                    tenantId: actor.tenantId,
                    variantId: item.variantId,
                    storeId: order.storeId,
                  },
                },
              }),
            );
            await tx.inventory.update({
              where: { id: stock.id },
              data:
                input.status === "SHIPPED"
                  ? {
                      onHand: { decrement: item.quantity },
                      reserved: { decrement: item.quantity },
                    }
                  : { onHand: { increment: item.quantity } },
            });
            await tx.stockMovement.create({
              data: {
                tenantId: actor.tenantId,
                variantId: item.variantId,
                storeId: order.storeId,
                actorId: actor.id,
                type:
                  input.status === "SHIPPED" ? "DISPATCH" : "DELIVERY_RETURN",
                quantity:
                  input.status === "SHIPPED" ? -item.quantity : item.quantity,
                reason: `${input.status}: ${order.number}`,
              },
            });
          }
          const updated = await tx.order.update({
            where: { id },
            data: {
              deliveryStatus: input.status,
              status:
                input.status === "SHIPPED" ? "IN_FULFILMENT" : "CANCELLED",
              carrier: input.carrier,
              trackingNumber: input.trackingNumber,
              reservationExpiresAt: null,
            },
          });
          await audit(tx, actor, `ORDER_${input.status}`, id, {
            carrier: input.carrier,
          });
          if (input.status === "RETURNED")
            await tx.rewardRedemption.updateMany({
              where: { tenantId: actor.tenantId, orderId: id },
              data: { status: "ISSUED", orderId: null },
            });
          if (input.status === "RETURNED" && order.couponId)
            await tx.coupon.update({
              where: { id: order.couponId },
              data: { used: { decrement: 1 } },
            });
          if (order.customerId)
            await tx.notification.create({
              data: {
                tenantId: actor.tenantId,
                customerId: order.customerId,
                title: `Order ${order.number}`,
                body:
                  input.status === "SHIPPED"
                    ? "Your order is on its way."
                    : "Your delivery was returned to the boutique.",
              },
            });
          return updated;
        },
      ),
    );
  });
  router.get("/storefront/:slug/tracking", async (req, res) => {
    const { number, token } = z
      .object({
        number: z.string().max(100),
        token: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(req.query);
    const tenant = requireFound(
      await db.tenant.findUnique({
        where: { slug: String(req.params.slug) },
        select: { id: true },
      }),
    );
    const order = requireFound(
      await db.order.findFirst({
        where: {
          tenantId: tenant.id,
          number,
          trackingTokenHash: tokenHash(token),
        },
        select: {
          number: true,
          status: true,
          total: true,
          currency: true,
          deliveryStatus: true,
          carrier: true,
          trackingNumber: true,
          createdAt: true,
          items: { select: { name: true, sku: true, quantity: true } },
        },
      }),
    );
    res.json(order);
  });
  return router;
}
