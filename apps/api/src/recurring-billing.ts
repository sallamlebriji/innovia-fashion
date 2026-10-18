import express from "express";
import { z } from "zod";
import type Stripe from "stripe";
import { db } from "./db.js";
import { permit } from "./auth.js";
import { command, audit, lockTenant, type Actor } from "./retail.js";
import { HttpError, requireFound } from "./errors.js";
import { billingClient, billingConfigured } from "./providers/billing.js";
import { activateInvoice } from "./billing.js";

const terminal = ["CANCELED", "EXPIRED", "INCOMPLETE_EXPIRED"];
const objectId = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id;
const date = (seconds: number) => new Date(seconds * 1000);

export async function prepareRecurringBilling(
  actor: Actor,
  planId: string,
  requestKey: string | undefined,
) {
  return command(
    actor,
    requestKey,
    { type: "recurring-enrollment", planId },
    async (tx) => {
      const existing = await tx.recurringBilling.findFirst({
        where: { tenantId: actor.tenantId, status: { notIn: terminal } },
      });
      if (existing) {
        if (
          existing.planId !== planId ||
          !["ENROLLING", "CHECKOUT"].includes(existing.status)
        )
          throw new HttpError(
            409,
            "RECURRING_EXISTS",
            "Manage the existing subscription before starting another plan.",
          );
        return existing;
      }
      const tenant = requireFound(
        await tx.tenant.findUnique({ where: { id: actor.tenantId } }),
      );
      if (tenant.subscriptionStatus === "SUSPENDED")
        throw new HttpError(
          409,
          "SUSPENDED",
          "Contact support before enabling recurring billing.",
        );
      if (tenant.paidThrough && tenant.paidThrough > new Date())
        throw new HttpError(
          409,
          "PAID_PERIOD_EXISTS",
          "Your current paid period must end before starting recurring billing.",
        );
      if (
        await tx.subscriptionInvoice.count({
          where: { tenantId: actor.tenantId, status: "PENDING" },
        })
      )
        throw new HttpError(
          409,
          "UNPAID_INVOICE_EXISTS",
          "Resolve existing subscription invoices before starting recurring billing.",
        );
      const plan = requireFound(
        await tx.subscriptionPlan.findUnique({ where: { id: planId } }),
      );
      const [products, stores, employees] = await Promise.all([
        tx.product.count({ where: { tenantId: actor.tenantId } }),
        tx.store.count({ where: { tenantId: actor.tenantId } }),
        tx.user.count({ where: { tenantId: actor.tenantId, active: true } }),
      ]);
      if (
        products > plan.productLimit ||
        stores > plan.storeLimit ||
        employees > plan.employeeLimit
      )
        throw new HttpError(
          409,
          "PLAN_LIMIT",
          "The selected plan cannot hold your current products, locations or employees.",
        );
      if (plan.monthlyPrice.lte(0))
        throw new HttpError(
          422,
          "PLAN_PRICE",
          "This plan does not have a supported monthly price.",
        );
      const enrollment = await tx.recurringBilling.create({
        data: {
          tenantId: actor.tenantId,
          planId,
          planName: plan.name,
          monthlyPrice: plan.monthlyPrice,
          currency: "MAD",
          attemptKey: crypto.randomUUID(),
        },
      });
      await audit(tx, actor, "RECURRING_BILLING_CONSENT", enrollment.id, {
        monthlyPrice: plan.monthlyPrice.toString(),
        currency: "MAD",
        consent: "monthly-renewal-v1",
      });
      return enrollment;
    },
  );
}

/** Signed events bind to a saved enrollment and immutable monthly price.
 * Checkout completion binds identifiers; only a paid service-period invoice grants access.
 */
export async function processRecurringEvent(event: Stripe.Event) {
  const checkoutEvent =
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.expired";
  const invoiceEvent = [
    "invoice.paid",
    "invoice.payment_failed",
    "invoice.payment_action_required",
  ].includes(event.type);
  const subscriptionEvent = [
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ].includes(event.type);
  if (!checkoutEvent && !invoiceEvent && !subscriptionEvent)
    return { ignored: true };
  const session = checkoutEvent
    ? (event.data.object as Stripe.Checkout.Session)
    : undefined;
  if (session && session.mode !== "subscription") return { ignored: true };
  const invoice = invoiceEvent
    ? (event.data.object as Stripe.Invoice)
    : undefined;
  const subscription = subscriptionEvent
    ? (event.data.object as Stripe.Subscription)
    : undefined;
  const details = invoice?.parent?.subscription_details;
  const metadata =
    session?.metadata ?? subscription?.metadata ?? details?.metadata;
  const id = metadata?.recurringId;
  if (!id) return { ignored: true };
  const saved = await db.recurringBilling.findUnique({ where: { id } });
  if (!saved) return { ignored: true };
  return db.$transaction(async (tx) => {
    await lockTenant(tx, saved.tenantId);
    if (await tx.recurringBillingEvent.count({ where: { id: event.id } }))
      return { duplicate: true };
    const current = await tx.recurringBilling.findUniqueOrThrow({
      where: { id },
    });
    const customerId = objectId(
      session?.customer ?? invoice?.customer ?? subscription?.customer,
    );
    const subscriptionId = objectId(
      session?.subscription ?? details?.subscription ?? subscription,
    );
    let status = "APPLIED";
    if (
      metadata?.attemptKey !== current.attemptKey ||
      metadata?.tenantId !== current.tenantId ||
      (current.customerId && customerId !== current.customerId) ||
      (current.subscriptionId && subscriptionId !== current.subscriptionId) ||
      (session &&
        (session.client_reference_id !== current.id ||
          (current.checkoutSessionId &&
            current.checkoutSessionId !== session.id)))
    )
      status = "BINDING_REVIEW";
    else if (event.type === "checkout.session.expired") {
      if (
        !current.subscriptionId &&
        ["ENROLLING", "CHECKOUT"].includes(current.status)
      )
        await tx.recurringBilling.update({
          where: { id },
          data: { status: "EXPIRED" },
        });
      else status = "STALE_EVENT";
    } else if (!customerId || !subscriptionId) status = "BINDING_REVIEW";
    else {
      await tx.recurringBilling.update({
        where: { id },
        data: {
          customerId,
          subscriptionId,
          ...(session ? { checkoutSessionId: session.id } : {}),
          ...(session && ["ENROLLING", "CHECKOUT"].includes(current.status)
            ? { status: "INCOMPLETE" }
            : {}),
        },
      });
      if (invoice && event.type === "invoice.paid") {
        const line = invoice.lines.data[0],
          expected = current.monthlyPrice.mul(100).toNumber();
        const duration = line ? line.period.end - line.period.start : 0;
        if (
          invoice.status !== "paid" ||
          invoice.amount_paid !== expected ||
          invoice.amount_remaining !== 0 ||
          invoice.total !== expected ||
          invoice.currency.toUpperCase() !== current.currency ||
          !["subscription_create", "subscription_cycle"].includes(
            invoice.billing_reason ?? "",
          ) ||
          invoice.lines.has_more ||
          invoice.lines.data.length !== 1 ||
          !line ||
          line.amount !== expected ||
          line.quantity !== 1 ||
          line.parent?.subscription_item_details?.subscription !==
            subscriptionId ||
          line.parent.subscription_item_details.proration ||
          duration < 27 * 86400 ||
          duration > 32 * 86400 ||
          line.period.start > event.created + 300
        )
          status = "PAYMENT_REVIEW";
        else {
          const previous = await tx.subscriptionInvoice.findUnique({
            where: { providerInvoiceId: invoice.id },
          });
          if (previous) status = "DUPLICATE_INVOICE";
          else {
            const paid = await tx.subscriptionInvoice.create({
              data: {
                tenantId: current.tenantId,
                planId: current.planId,
                planName: current.planName,
                number: `SAAS-${invoice.id}`,
                providerInvoiceId: invoice.id,
                amount: current.monthlyPrice,
                currency: current.currency,
                periodStart: date(line.period.start),
                periodEnd: date(line.period.end),
                status: "PAID",
                paidAt: date(
                  invoice.status_transitions.paid_at ?? event.created,
                ),
                paymentMethod: "STRIPE_RECURRING",
                paymentReference: invoice.id,
              },
            });
            await activateInvoice(tx, paid.id, {
              tenantId: current.tenantId,
              id: "stripe",
              role: "PLATFORM_ADMIN",
            });
          }
          // A late payment cannot resurrect a canceled enrollment or roll back its period.
          await tx.recurringBilling.update({
            where: { id },
            data: {
              ...(!terminal.includes(current.status)
                ? { status: "ACTIVE" }
                : {}),
              lastStateEvent: Math.max(current.lastStateEvent, event.created),
              ...(!current.currentPeriodEnd ||
              date(line.period.end) > current.currentPeriodEnd
                ? { currentPeriodEnd: date(line.period.end) }
                : {}),
            },
          });
        }
      } else if (subscription) {
        if (
          event.created < current.lastStateEvent ||
          (terminal.includes(current.status) &&
            subscription.status !== "canceled")
        )
          status = "STALE_EVENT";
        else {
          await tx.recurringBilling.update({
            where: { id },
            data: {
              status: subscription.status.toUpperCase(),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              lastStateEvent: event.created,
            },
          });
        }
      } else if (invoice) {
        const paid = await tx.subscriptionInvoice.findUnique({
          where: { providerInvoiceId: invoice.id },
        });
        if (
          paid ||
          event.created < current.lastStateEvent ||
          terminal.includes(current.status)
        )
          status = "STALE_EVENT";
        else
          await tx.recurringBilling.update({
            where: { id },
            data: {
              status:
                event.type === "invoice.payment_action_required"
                  ? "ACTION_REQUIRED"
                  : "PAST_DUE",
              lastStateEvent: event.created,
            },
          });
      }
    }
    await tx.recurringBillingEvent.create({
      data: {
        id: event.id,
        tenantId: current.tenantId,
        billingId: id,
        objectId: (session ?? invoice ?? subscription)!.id,
        type: event.type,
        status,
      },
    });
    await audit(
      tx,
      { tenantId: current.tenantId, id: "stripe", role: "PLATFORM_ADMIN" },
      "RECURRING_WEBHOOK",
      id,
      { eventId: event.id, type: event.type, status },
    );
    return { received: true, status };
  });
}

export function recurringBillingRouter() {
  const router = express.Router();
  router.get("/billing/recurring", permit("OWNER"), async (_req, res) => {
    const tenantId: string = res.locals.actor.tenantId;
    const [enrollment, plans] = await Promise.all([
      db.recurringBilling.findFirst({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          planId: true,
          planName: true,
          monthlyPrice: true,
          currency: true,
          status: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: true,
        },
      }),
      db.subscriptionPlan.findMany({
        orderBy: { monthlyPrice: "asc" },
        select: {
          id: true,
          name: true,
          monthlyPrice: true,
          productLimit: true,
          storeLimit: true,
          employeeLimit: true,
        },
      }),
    ]);
    res.json({ configured: billingConfigured(), enrollment, plans });
  });
  router.post(
    "/billing/recurring/checkout",
    permit("OWNER"),
    async (req, res) => {
      const stripe = billingClient(),
        actor: Actor = res.locals.actor;
      const input = z
        .object({
          planId: z.string().min(1),
          consent: z.literal("monthly-renewal-v1"),
        })
        .strict()
        .parse(req.body);
      const enrollment = await prepareRecurringBilling(
        actor,
        input.planId,
        req.get("Idempotency-Key"),
      );
      const current = await db.recurringBilling.findUniqueOrThrow({
        where: { id: enrollment.id },
      });
      if (
        current.subscriptionId ||
        !["ENROLLING", "CHECKOUT"].includes(current.status)
      )
        throw new HttpError(
          409,
          "RECURRING_EXISTS",
          "This subscription already started or ended. Refresh billing before continuing.",
        );
      if (current.checkoutSessionId) {
        const existing = await stripe.checkout.sessions.retrieve(
          current.checkoutSessionId,
        );
        if (existing.status === "open" && existing.url) {
          res.json({ url: existing.url });
          return;
        }
        if (existing.status === "expired") {
          await db.recurringBilling.updateMany({
            where: { id: current.id, subscriptionId: null },
            data: { status: "EXPIRED" },
          });
          throw new HttpError(
            410,
            "CHECKOUT_EXPIRED",
            "This payment page expired. Refresh billing and start again.",
          );
        }
        throw new HttpError(
          409,
          "PAYMENT_PENDING",
          "The subscription is being confirmed. Refresh billing shortly.",
        );
      }
      // Stripe may discard idempotency keys after 24 hours. An uncertain submission
      // must be reconciled instead of creating another chargeable subscription.
      if (
        current.checkoutRequestedAt &&
        Date.now() - current.checkoutRequestedAt.getTime() > 23 * 3600000
      )
        throw new HttpError(
          409,
          "SUBMISSION_REVIEW",
          "This subscription request needs provider reconciliation. Contact support before trying again.",
        );
      if (!current.checkoutRequestedAt)
        await db.recurringBilling.updateMany({
          where: { id: current.id, checkoutRequestedAt: null },
          data: { checkoutRequestedAt: new Date() },
        });
      const metadata = {
        recurringId: current.id,
        attemptKey: current.attemptKey,
        tenantId: actor.tenantId,
      };
      const origin = process.env.ADMIN_ORIGIN ?? "http://localhost:5174";
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          allowed_payment_method_types: ["card"],
          client_reference_id: current.id,
          metadata,
          subscription_data: { metadata },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: current.currency.toLowerCase(),
                unit_amount: current.monthlyPrice.mul(100).toNumber(),
                recurring: { interval: "month" },
                product_data: { name: `INNOVIA ${current.planName}` },
              },
            },
          ],
          success_url: `${origin}/settings?subscription=returned`,
          cancel_url: `${origin}/settings?subscription=cancelled`,
        },
        { idempotencyKey: `innovia_recurring_${current.attemptKey}` },
      );
      await db.recurringBilling.updateMany({
        where: { id: current.id, subscriptionId: null, status: "ENROLLING" },
        data: { checkoutSessionId: session.id, status: "CHECKOUT" },
      });
      if (!session.url)
        throw new HttpError(
          502,
          "CHECKOUT_URL",
          "The provider did not return a subscription page.",
        );
      res.json({ url: session.url });
    },
  );
  router.post(
    "/billing/recurring/:id/cancel",
    permit("OWNER"),
    async (req, res) => {
      const stripe = billingClient(),
        actor: Actor = res.locals.actor;
      z.object({ confirmed: z.literal(true) })
        .strict()
        .parse(req.body);
      const enrollment = requireFound(
        await db.recurringBilling.findFirst({
          where: { id: String(req.params.id), tenantId: actor.tenantId },
        }),
      );
      if (!enrollment.subscriptionId || terminal.includes(enrollment.status))
        throw new HttpError(
          409,
          "RECURRING_INACTIVE",
          "There is no active provider subscription to cancel.",
        );
      const canceled = await stripe.subscriptions.update(
        enrollment.subscriptionId,
        { cancel_at_period_end: true },
        { idempotencyKey: `innovia_cancel_${enrollment.id}` },
      );
      await db.$transaction(async (tx) => {
        await lockTenant(tx, actor.tenantId);
        await tx.recurringBilling.update({
          where: { id: enrollment.id },
          data: { cancelAtPeriodEnd: canceled.cancel_at_period_end },
        });
        await audit(tx, actor, "RECURRING_CANCEL_REQUESTED", enrollment.id, {
          cancelAtPeriodEnd: canceled.cancel_at_period_end,
        });
      });
      res.json({ cancelAtPeriodEnd: canceled.cancel_at_period_end });
    },
  );
  router.post(
    "/billing/recurring/:id/payment-method",
    permit("OWNER"),
    async (req, res) => {
      const stripe = billingClient(),
        actor: Actor = res.locals.actor;
      const enrollment = requireFound(
        await db.recurringBilling.findFirst({
          where: { id: String(req.params.id), tenantId: actor.tenantId },
        }),
      );
      if (
        !enrollment.customerId ||
        !enrollment.subscriptionId ||
        terminal.includes(enrollment.status)
      )
        throw new HttpError(
          409,
          "RECURRING_INACTIVE",
          "There is no active provider subscription to manage.",
        );
      const configuration = await stripe.billingPortal.configurations.create(
        {
          business_profile: { headline: "Manage your INNOVIA payment method" },
          features: {
            payment_method_update: { enabled: true },
            invoice_history: { enabled: true },
          },
        },
        { idempotencyKey: "innovia_payment_method_portal_v1" },
      );
      const portal = await stripe.billingPortal.sessions.create({
        customer: enrollment.customerId,
        configuration: configuration.id,
        return_url: `${process.env.ADMIN_ORIGIN ?? "http://localhost:5174"}/settings`,
      });
      res.json({ url: portal.url });
    },
  );
  return router;
}
