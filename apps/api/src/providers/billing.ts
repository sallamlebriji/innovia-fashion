import Stripe from "stripe";
import { HttpError } from "../errors.js";
export const billingConfigured = () =>
  !!process.env.STRIPE_SECRET_KEY &&
  !!process.env.STRIPE_WEBHOOK_SECRET &&
  process.env.BILLING_PROVIDER_APPROVED === "true";
export function billingClient() {
  if (!billingConfigured())
    throw new HttpError(
      503,
      "BILLING_UNCONFIGURED",
      "Online billing has not been configured and approved by the platform operator.",
    );
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    timeout: 30000,
    maxNetworkRetries: 0,
  });
}
export function verifyBillingEvent(
  body: Buffer,
  signature: string,
  secret = process.env.STRIPE_WEBHOOK_SECRET,
) {
  if (!secret)
    throw new HttpError(
      503,
      "BILLING_UNCONFIGURED",
      "The billing webhook is not configured.",
    );
  try {
    return Stripe.webhooks.constructEvent(body, signature, secret, 300);
  } catch {
    throw new HttpError(
      400,
      "BILLING_SIGNATURE",
      "The payment webhook signature could not be verified.",
    );
  }
}
