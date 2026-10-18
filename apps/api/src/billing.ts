import express, { type RequestHandler } from "express";
import { randomUUID, createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { z } from "zod";
import { db } from "./db.js";
import { auth, tenantRequired, permit } from "./auth.js";
import { command, audit, lockTenant, type Actor } from "./retail.js";
import { HttpError, requireFound } from "./errors.js";
import {
  recurringBillingRouter,
  processRecurringEvent,
} from "./recurring-billing.js";
import {
  billingConfigured,
  billingClient,
  verifyBillingEvent,
} from "./providers/billing.js";
type Tx = Prisma.TransactionClient;
export function periodEnd(start: Date, months: number) {
  const result = new Date(start),
    day = start.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(start.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}
export async function activateInvoice(tx: Tx, id: string, actor: Actor) {
  const invoice = await tx.subscriptionInvoice.findUniqueOrThrow({
      where: { id },
      include: { plan: true },
    }),
    tenant = await tx.tenant.findUniqueOrThrow({
      where: { id: invoice.tenantId },
    });
  let activationStatus = "APPLIED";
  if (invoice.periodEnd <= new Date()) activationStatus = "EXPIRED_PERIOD";
  else if (invoice.periodStart > new Date()) activationStatus = "SCHEDULED";
  else if (tenant.subscriptionStatus === "SUSPENDED")
    activationStatus = "SUSPENDED_REVIEW";
  else if (tenant.paidThrough && invoice.periodEnd < tenant.paidThrough)
    activationStatus = "STALE_PERIOD";
  else {
    const [products, stores, employees] = await Promise.all([
      tx.product.count({ where: { tenantId: tenant.id } }),
      tx.store.count({ where: { tenantId: tenant.id } }),
      tx.user.count({ where: { tenantId: tenant.id, active: true } }),
    ]);
    if (
      products > invoice.plan.productLimit ||
      stores > invoice.plan.storeLimit ||
      employees > invoice.plan.employeeLimit
    )
      activationStatus = "LIMIT_REVIEW";
  }
  if (activationStatus === "APPLIED")
    await tx.tenant.update({
      where: { id: tenant.id },
      data: {
        planId: invoice.planId,
        subscriptionStatus: "ACTIVE",
        trialEndsAt: null,
        paidThrough: invoice.periodEnd,
      },
    });
  await tx.subscriptionInvoice.update({
    where: { id },
    data: { activationStatus },
  });
  await audit(tx, actor, "SUBSCRIPTION_PAYMENT_APPLIED", id, {
    activationStatus,
    periodEnd: invoice.periodEnd.toISOString(),
  });
  return activationStatus;
}
export async function settleInvoice(
  tx: Tx,
  actor: Actor,
  id: string,
  paymentMethod: string,
  paymentReference: string,
) {
  const invoice = requireFound(
    await tx.subscriptionInvoice.findFirst({
      where: { tenantId: actor.tenantId, id, status: "PENDING" },
    }),
  );
  await tx.subscriptionInvoice.update({
    where: { id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentMethod,
      paymentReference,
    },
  });
  await activateInvoice(tx, invoice.id, actor);
  return tx.subscriptionInvoice.findUniqueOrThrow({ where: { id } });
}
export async function processBillingEvent(event: Stripe.Event) {
  const recurring = await processRecurringEvent(event);
  if (!("ignored" in recurring)) return recurring;
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ].includes(event.type)
  )
    return { ignored: true };
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid" || session.mode !== "payment")
    return { ignored: true };
  const id = session.metadata?.invoiceId;
  if (!id) return { ignored: true };
  const invoice = await db.subscriptionInvoice.findUnique({ where: { id } });
  if (!invoice) return { ignored: true };
  return db.$transaction(async (tx) => {
    await lockTenant(tx, invoice.tenantId);
    if (await tx.billingEvent.count({ where: { id: event.id } }))
      return { duplicate: true };
    const current = await tx.subscriptionInvoice.findUniqueOrThrow({
      where: { id },
    });
    const expected = current.amount.mul(100).toNumber(),
      bound =
        current.checkoutSessionId === session.id ||
        current.checkoutSessionId === `pending_${session.metadata?.attemptKey}`;
    let status = "APPLIED";
    if (
      session.amount_total !== expected ||
      session.currency?.toUpperCase() !== current.currency ||
      session.client_reference_id !== id ||
      !bound
    )
      status = "PAYMENT_REVIEW";
    else if (current.status === "PAID")
      status =
        current.paymentReference === session.id
          ? "DUPLICATE_EVENT"
          : "DUPLICATE_PAYMENT_REVIEW";
    else if (current.status !== "PENDING") status = "VOID_PAYMENT_REVIEW";
    else {
      await tx.subscriptionInvoice.update({
        where: { id },
        data: { checkoutSessionId: session.id },
      });
      await settleInvoice(
        tx,
        { tenantId: invoice.tenantId, id: "stripe", role: "PLATFORM_ADMIN" },
        id,
        "STRIPE",
        session.id,
      );
    }
    await tx.billingEvent.create({
      data: {
        id: event.id,
        tenantId: invoice.tenantId,
        invoiceId: id,
        sessionId: session.id,
        status,
      },
    });
    await audit(
      tx,
      { tenantId: invoice.tenantId, id: "stripe", role: "PLATFORM_ADMIN" },
      "BILLING_WEBHOOK",
      id,
      { eventId: event.id, status },
    );
    return { received: true, status };
  });
}
export const billingWebhook: RequestHandler = async (req, res) => {
  if (!billingConfigured())
    throw new HttpError(
      503,
      "BILLING_UNCONFIGURED",
      "The billing provider is unavailable.",
    );
  const signature = req.get("Stripe-Signature") ?? "";
  const event = verifyBillingEvent(req.body, signature);
  res.json(await processBillingEvent(event));
};
export async function activateScheduledInvoices() {
  const invoices = await db.subscriptionInvoice.findMany({
    where: {
      status: "PAID",
      activationStatus: "SCHEDULED",
      periodStart: { lte: new Date() },
    },
    take: 20,
  });
  for (const invoice of invoices)
    await db.$transaction(async (tx) => {
      await lockTenant(tx, invoice.tenantId);
      const current = await tx.subscriptionInvoice.findUniqueOrThrow({
        where: { id: invoice.id },
      });
      if (current.activationStatus === "SCHEDULED")
        await activateInvoice(tx, current.id, {
          tenantId: current.tenantId,
          id: "system",
          role: "PLATFORM_ADMIN",
        });
    });
}
export function billingRouter() {
  const router = express.Router();
  router.use("/billing", auth, tenantRequired);
  router.use(recurringBillingRouter());
  router.get("/billing", async (req, res) => {
    const tenantId: string = res.locals.actor.tenantId,
      page = z.coerce
        .number()
        .int()
        .min(1)
        .parse(req.query.page ?? 1);
    const [invoices, total] = await Promise.all([
      db.subscriptionInvoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 24,
        take: 24,
      }),
      db.subscriptionInvoice.count({ where: { tenantId } }),
    ]);
    res.json({ invoices, total, onlinePayments: billingConfigured() });
  });
  router.post("/billing/:id/checkout", permit("OWNER"), async (req, res) => {
    const stripe = billingClient(),
      actor: Actor = res.locals.actor,
      id = String(req.params.id),
      key = req.get("Idempotency-Key");
    if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key))
      throw new HttpError(
        400,
        "IDEMPOTENCY_REQUIRED",
        "Provide a valid payment request key.",
      );
    let attemptKey = createHash("sha256")
        .update(`${actor.tenantId}:${id}:${key}`)
        .digest("hex"),
      sentinel = `pending_${attemptKey}`;
    const invoice = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const invoice = requireFound(
        await tx.subscriptionInvoice.findFirst({
          where: { id, tenantId: actor.tenantId, status: "PENDING" },
        }),
      );
      if (invoice.checkoutSessionId?.startsWith("pending_")) {
        if (
          !invoice.checkoutRequestedAt ||
          Date.now() - invoice.checkoutRequestedAt.getTime() > 23 * 3600000
        )
          throw new HttpError(
            409,
            "SUBMISSION_REVIEW",
            "This payment request needs provider reconciliation before another attempt. Contact support.",
          );
        sentinel = invoice.checkoutSessionId;
        attemptKey = sentinel.slice("pending_".length);
      }
      if (!invoice.checkoutSessionId)
        await tx.subscriptionInvoice.update({
          where: { id },
          data: {
            checkoutSessionId: sentinel,
            checkoutRequestedAt: new Date(),
          },
        });
      return invoice;
    });
    if (
      invoice.checkoutSessionId &&
      !invoice.checkoutSessionId.startsWith("pending_")
    ) {
      const existing = await stripe.checkout.sessions.retrieve(
        invoice.checkoutSessionId,
      );
      if (existing.status === "open" && existing.url) {
        res.json({ url: existing.url });
        return;
      }
      if (existing.status === "expired") {
        await db.$transaction(async (tx) => {
          await lockTenant(tx, actor.tenantId);
          await tx.subscriptionInvoice.updateMany({
            where: { id, status: "PENDING", checkoutSessionId: existing.id },
            data: { checkoutSessionId: null, checkoutRequestedAt: null },
          });
        });
        throw new HttpError(
          410,
          "CHECKOUT_EXPIRED",
          "This payment page expired. Start a new payment request.",
        );
      }
      throw new HttpError(
        409,
        "PAYMENT_PENDING",
        "The payment is being confirmed. Refresh your invoices shortly.",
      );
    }
    const origin = process.env.ADMIN_ORIGIN ?? "http://localhost:5174",
      session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          client_reference_id: id,
          metadata: { invoiceId: id, attemptKey },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: invoice.currency.toLowerCase(),
                unit_amount: invoice.amount.mul(100).toNumber(),
                product_data: {
                  name: `INNOVIA ${invoice.planName} · ${invoice.number}`,
                },
              },
            },
          ],
          success_url: `${origin}/settings?billing=returned`,
          cancel_url: `${origin}/settings?billing=cancelled`,
        },
        { idempotencyKey: `innovia_${attemptKey}` },
      );
    await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      await tx.subscriptionInvoice.updateMany({
        where: { id, status: "PENDING", checkoutSessionId: sentinel },
        data: { checkoutSessionId: session.id },
      });
    });
    if (!session.url)
      throw new HttpError(
        502,
        "CHECKOUT_URL",
        "The provider did not return a payment page.",
      );
    res.json({ url: session.url });
  });
  router.use("/platform/billing", auth, permit("PLATFORM_ADMIN"));
  router.get("/platform/billing", async (req, res) => {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .parse(req.query.page ?? 1);
    const [invoices, total, revenue, review, recurringReview] =
      await Promise.all([
        db.subscriptionInvoice.findMany({
          include: { tenant: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * 24,
          take: 24,
        }),
        db.subscriptionInvoice.count(),
        db.subscriptionInvoice.aggregate({
          where: { status: "PAID" },
          _sum: { amount: true },
        }),
        db.billingEvent.findMany({
          where: { status: { contains: "REVIEW" } },
          orderBy: { receivedAt: "desc" },
          take: 25,
        }),
        db.recurringBillingEvent.findMany({
          where: { status: { contains: "REVIEW" } },
          orderBy: { receivedAt: "desc" },
          take: 25,
        }),
      ]);
    res.json({
      invoices,
      total,
      paidRevenue: revenue._sum.amount ?? "0.00",
      review: [
        ...review,
        ...recurringReview.map((entry) => ({
          ...entry,
          invoiceId: entry.objectId,
        })),
      ],
      onlinePayments: billingConfigured(),
    });
  });
  router.post("/platform/billing", async (req, res) => {
    const input = z
        .object({
          tenantId: z.string().min(1),
          planId: z.string().min(1),
          months: z.number().int().min(1).max(12),
          periodStart: z.string().datetime(),
        })
        .parse(req.body),
      actor: Actor = { ...res.locals.actor, tenantId: input.tenantId };
    res.status(201).json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "subscription-invoice", ...input },
        async (tx) => {
          if (
            await tx.recurringBilling.count({
              where: {
                tenantId: actor.tenantId,
                status: {
                  notIn: ["CANCELED", "EXPIRED", "INCOMPLETE_EXPIRED"],
                },
              },
            })
          )
            throw new HttpError(
              409,
              "RECURRING_EXISTS",
              "Resolve recurring billing before issuing a separate subscription invoice.",
            );
          const plan = requireFound(
              await tx.subscriptionPlan.findUnique({
                where: { id: input.planId },
              }),
            ),
            amount = plan.monthlyPrice.mul(input.months);
          if (amount.lte(0) || amount.gt("9999999999.99"))
            throw new HttpError(
              422,
              "INVOICE_AMOUNT",
              "The invoice amount is outside the supported range.",
            );
          const invoice = await tx.subscriptionInvoice.create({
            data: {
              tenantId: actor.tenantId,
              planId: plan.id,
              planName: plan.name,
              number: `SAAS-${randomUUID().slice(0, 8).toUpperCase()}`,
              amount,
              currency: "MAD",
              periodStart: new Date(input.periodStart),
              periodEnd: periodEnd(new Date(input.periodStart), input.months),
            },
          });
          await audit(tx, actor, "SUBSCRIPTION_INVOICE_CREATED", invoice.id, {
            amount: amount.toString(),
            currency: "MAD",
            months: input.months,
          });
          return invoice;
        },
      ),
    );
  });
  router.post("/platform/billing/:id/pay", async (req, res) => {
    const input = z
        .object({
          paymentMethod: z.enum(["BANK_TRANSFER", "CASH"]),
          paymentReference: z.string().min(3).max(200),
          confirmedReceived: z.literal(true),
        })
        .parse(req.body),
      id = String(req.params.id),
      invoice = requireFound(
        await db.subscriptionInvoice.findUnique({ where: { id } }),
      ),
      actor: Actor = { ...res.locals.actor, tenantId: invoice.tenantId };
    res.json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "invoice-manual-payment", id, ...input },
        async (tx) => {
          if (
            (await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id } }))
              .checkoutSessionId
          )
            throw new HttpError(
              409,
              "ONLINE_CHECKOUT_EXISTS",
              "Confirm or expire the online payment before recording a manual payment.",
            );
          return settleInvoice(
            tx,
            actor,
            id,
            input.paymentMethod,
            input.paymentReference,
          );
        },
      ),
    );
  });
  router.post("/platform/billing/:id/void", async (req, res) => {
    const id = String(req.params.id),
      invoice = requireFound(
        await db.subscriptionInvoice.findUnique({ where: { id } }),
      ),
      actor: Actor = { ...res.locals.actor, tenantId: invoice.tenantId };
    if (invoice.checkoutSessionId)
      throw new HttpError(
        409,
        "ONLINE_CHECKOUT_EXISTS",
        "Resolve the online payment before voiding this invoice.",
      );
    res.json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "invoice-void", id },
        async (tx) => {
          if (
            (await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id } }))
              .checkoutSessionId
          )
            throw new HttpError(
              409,
              "ONLINE_CHECKOUT_EXISTS",
              "Resolve the online payment before voiding this invoice.",
            );
          requireFound(
            await tx.subscriptionInvoice.findFirst({
              where: { id, status: "PENDING" },
            }),
          );
          await audit(tx, actor, "INVOICE_VOIDED", id, {});
          return tx.subscriptionInvoice.update({
            where: { id },
            data: { status: "VOID", activationStatus: "VOID" },
          });
        },
      ),
    );
  });
  router.post("/platform/billing/:id/activate", async (req, res) => {
    const id = String(req.params.id),
      invoice = requireFound(
        await db.subscriptionInvoice.findFirst({
          where: { id, status: "PAID" },
        }),
      ),
      actor: Actor = { ...res.locals.actor, tenantId: invoice.tenantId };
    res.json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "invoice-activation", id },
        (tx) => activateInvoice(tx, id, actor),
      ),
    );
  });
  return router;
}
