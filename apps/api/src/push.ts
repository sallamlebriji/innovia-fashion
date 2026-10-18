import express from "express";
import { z } from "zod";
import { db } from "./db.js";
import { customerAuth } from "./customer-auth.js";
import { HttpError, requireFound } from "./errors.js";
export const pushConfigured = () =>
  process.env.PUSH_PROVIDER_APPROVED === "true" &&
  !!process.env.EXPO_ACCESS_TOKEN;
export function pushRouter() {
  const root = express.Router(),
    router = express.Router({ mergeParams: true });
  root.use("/storefront/:slug/customer/push", router);
  router.use(async (req, res, next) => {
    res.locals.boutique = requireFound(
      await db.tenant.findUnique({
        where: { slug: String((req.params as Record<string, string>).slug) },
        select: { id: true },
      }),
    );
    next();
  }, customerAuth);
  router.post("/devices", async (req, res) => {
    const { token } = z
      .object({
        token: z
          .string()
          .max(300)
          .regex(/^(ExponentPushToken|ExpoPushToken)\[[a-zA-Z0-9_-]+\]$/),
      })
      .strict()
      .parse(req.body);
    if (!pushConfigured())
      throw new HttpError(
        503,
        "PUSH_UNCONFIGURED",
        "Push delivery needs an approved Expo project and server credentials. Your account messages remain available.",
      );
    const identity = {
      tenantId: res.locals.customerActor.tenantId,
      customerId: res.locals.customerActor.id,
      token,
    };
    await db.pushDevice.upsert({
      where: { tenantId_customerId_token: identity },
      create: identity,
      update: { active: true, registeredAt: new Date() },
    });
    res.json({ registered: true });
  });
  router.delete("/devices", async (req, res) => {
    const { token } = z
      .object({ token: z.string().max(300) })
      .strict()
      .parse(req.body);
    await db.pushDevice.updateMany({
      where: {
        tenantId: res.locals.customerActor.tenantId,
        customerId: res.locals.customerActor.id,
        token,
      },
      data: { active: false },
    });
    res.json({ ok: true });
  });
  return root;
}
type PushTransport = (
  data: {
    to: string;
    title: string;
    body: string;
    data: { notificationId: string };
  },
  receipt?: string,
) => Promise<{ status: string; id?: string; details?: { error?: string } }>;
async function livePush(data: Parameters<PushTransport>[0], receipt?: string) {
  const response = await fetch(
    `https://exp.host/--/api/v2/push/${receipt ? "getReceipts" : "send"}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(receipt ? { ids: [receipt] } : data),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error("PUSH_HTTP");
  const result = await response.json();
  return receipt ? result.data?.[receipt] : result.data;
}
export async function runPush(transport: PushTransport = livePush) {
  if (transport === livePush && !pushConfigured()) return;
  // Select undelivered device/message pairs, so a high-volume inbox cannot starve older messages.
  const pending = await db.$queryRaw<
    {
      notificationId: string;
      deviceId: string;
      token: string;
      title: string;
      body: string;
    }[]
  >`
    SELECT n.id AS notificationId, d.id AS deviceId, d.token, n.title, n.body
    FROM Notification n JOIN PushDevice d ON d.tenantId = n.tenantId AND d.customerId = n.customerId
    LEFT JOIN PushDelivery p ON p.notificationId = n.id AND p.deviceId = d.id
    WHERE d.active = true AND p.id IS NULL AND n.createdAt > ${new Date(Date.now() - 86400000)}
      AND (n.kind <> 'MARKETING' OR EXISTS (SELECT 1 FROM CustomerConsent c WHERE c.tenantId = n.tenantId AND c.customerId = n.customerId AND c.purpose = 'IN_APP_MARKETING' AND c.granted = true))
    ORDER BY n.createdAt ASC, n.id ASC, d.id ASC LIMIT 50`;
  for (const pair of pending) {
    const device = { id: pair.deviceId, token: pair.token },
      notice = { id: pair.notificationId, title: pair.title, body: pair.body };
    const result = await db.pushDelivery.createMany({
      data: { notificationId: notice.id, deviceId: device.id },
      skipDuplicates: true,
    });
    if (!result.count) continue;
    const identity = {
      notificationId_deviceId: {
        notificationId: notice.id,
        deviceId: device.id,
      },
    };
    try {
      const ticket = await transport({
        to: device.token,
        title: notice.title,
        body: notice.body.slice(0, 250),
        data: { notificationId: notice.id },
      });
      await db.pushDelivery.update({
        where: identity,
        data: {
          status: ticket.status === "ok" ? "ACCEPTED" : "FAILED",
          receiptId: ticket.id ?? null,
        },
      });
      if (ticket.details?.error === "DeviceNotRegistered")
        await db.pushDevice.update({
          where: { id: device.id },
          data: { active: false },
        });
    } catch {
      await db.pushDelivery.update({
        where: identity,
        data: { status: "UNCERTAIN" },
      });
    }
  }
  const receipts = await db.pushDelivery.findMany({
    where: {
      status: "ACCEPTED",
      receiptId: { not: null },
      createdAt: { lt: new Date(Date.now() - 900000) },
    },
    include: { device: true },
    take: 50,
  });
  for (const delivery of receipts) {
    try {
      const receipt = await transport(
        {
          to: delivery.device.token,
          title: "",
          body: "",
          data: { notificationId: delivery.notificationId },
        },
        delivery.receiptId!,
      );
      if (!receipt) continue;
      await db.pushDelivery.update({
        where: { id: delivery.id },
        data: {
          status: receipt.status === "ok" ? "PROVIDER_DELIVERED" : "FAILED",
          checkedAt: new Date(),
        },
      });
      if (receipt.details?.error === "DeviceNotRegistered")
        await db.pushDevice.update({
          where: { id: delivery.deviceId },
          data: { active: false },
        });
    } catch {
      /* Receipt fetches are safe to retry; accepted messages are never resent. */
    }
  }
  await db.pushDelivery.updateMany({
    where: {
      status: "CLAIMED",
      createdAt: { lt: new Date(Date.now() - 60000) },
    },
    data: { status: "UNCERTAIN" },
  });
}
