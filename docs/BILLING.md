# Subscription billing

INNOVIA now supports independent SaaS invoice payments and optional automatic monthly renewal through the existing Stripe adapter. Retail payments are a separate merchant integration. No live card or renewal charge has been executed.

## Owner workflow

Workspace Settings shows monthly plans and the saved agreed price. Starting renewal requires explicit monthly-renewal consent and opens hosted Checkout. Billing starts immediately; any remaining trial ends only when a valid paid invoice activates the workspace. Existing paid periods, pending manual invoices, incompatible usage and operator suspension block new enrollment. This avoids overlapping subscriptions and paid periods.

The owner can manage payment methods through a restricted hosted portal or cancel renewal at the end of the current paid period. Cancellation preserves access until `paidThrough`. Plan changes require ending the existing renewal and enrolling after that paid period ends; automatic proration and mid-period plan changes are not supported. A plan price edit affects future enrollments; the agreed recurring price snapshot stays fixed.

## Provider setup

Configure an eligible platform Stripe account with `BILLING_PROVIDER_APPROVED=true`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and final HTTPS `ADMIN_ORIGIN`. The adapter uses the installed Stripe 23 API types. It creates monthly MAD prices and restricts the allowed payment method to card. Verify currency/account eligibility and platform tax treatment before live use.

Register `/api/v1/billing/stripe/webhook` and subscribe to:

- `checkout.session.completed`, `checkout.session.expired` and the existing individual-payment success event.
- `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`.
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

Stripe Checkout completion binds the saved enrollment to customer/subscription identifiers. It does not grant paid access. A signed paid invoice must match the enrollment, customer, subscription, agreed amount/currency and one complete monthly service-period line. Service dates come from the line item, rather than the invoice accounting period. Duplicate event and provider-invoice identifiers are stored persistently. Invalid amounts, bindings, proration or unsupported invoice shapes remain in the operator review queue.

Late status events cannot revive a canceled enrollment. Paid periods do not roll backward and renewal payments cannot lift operator suspensions. A failed charge does not delete financial history; access still follows the actual paid period. Retries reuse a durable provider idempotency key. Uncertain submissions older than 23 hours require reconciliation before another provider call because Stripe may expire keys after 24 hours. Support must inspect Stripe using the saved enrollment/attempt metadata and actual provider records before resolving such an attempt; no manual guess or blind resubmission is safe.

## Acceptance boundaries

Eight new local integration checks cover enrollment retries, Checkout/invoice ordering, immutable prices, duplicate invoices, incorrect bindings/amounts/periods, cancellation/stale events, suspension and expired submission windows. Signatures are also exercised by the existing billing suite. These fixtures establish local state handling; hosted Checkout, SCA, real renewal retries, taxes, dispute/refund operations and portal behavior require provider sandbox/live acceptance before launch.

The implementation follows [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [Checkout subscriptions](https://docs.stripe.com/payments/checkout/build-subscriptions), [invoice service-period guidance](https://docs.stripe.com/api/invoices/object) and [customer portal integration](https://docs.stripe.com/customer-management/integrate-customer-portal). Configure dispute/refund monitoring and financial reconciliation in Stripe before collecting live revenue; automatic refund/dispute handling is not implemented.
