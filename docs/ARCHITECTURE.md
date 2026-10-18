# Architecture

## Applications and authoritative contracts

A Vite application provides merchant, POS and platform layouts with role-based routes. Next.js serves boutiques with server rendering and a same-origin proxy restricted to storefront/customer routes. Expo uses the same API with boutique-bound bearer sessions. Shared packages contain validation, web types, requests, tokens and primitives; native controls remain native.

Express owns prices, stock, customer identity, orders, membership, content, subscription usage, jobs and audits. MySQL 8.4 and Prisma 6.19 persist business data; no MongoDB or local JSON business database is used. Local email files are development delivery artifacts.

## Identity, tenancy and entitlements

Merchant/operator identity comes from hashed cookie-session tokens. Customers use tenant-specific cookies plus CSRF, or native bearer tokens in SecureStore. Queries derive scope from authenticated identities or a resolved boutique; compound tenant foreign keys reinforce predicates. Staff access changes revoke sessions. Invitation/recovery tokens are hashed, expiring and single-use; recovery email bodies are encrypted in the outbox.

Services enforce plan features and quotas. Null feature lists preserve legacy access; explicit lists gate COMMERCE, CMS, LOYALTY, CRM, REPORTS, AI and AR. Expired/suspended workspaces cannot create commerce, while financial closure and billing recovery remain available.

## Transactional retail

Decimal arithmetic is authoritative. Orders snapshot currency, tax/refund policy, prices, allocated discounts, costs and loyalty awards. Catalog/rule changes cannot rewrite historical sales. Legacy costs are marked uncaptured and suppress margins.

A tenant row lock serializes critical stock/quota commands. Idempotent commands fingerprint actor and payload; matching retries return persisted responses, changed payloads conflict. This coarse lock prioritizes correctness and needs measurement before high-volume deployment. Availability is onHand minus reserved.

| Operation | On hand | Reserved | State |
| --- | --- | --- | --- |
| Cash POS | Decrease | Unchanged | COMPLETED |
| Pickup/COD checkout | Unchanged | Increase | PENDING |
| Pickup completion | Decrease | Decrease | COMPLETED |
| COD dispatch | Decrease | Decrease | IN_FULFILMENT |
| COD collected | Unchanged | Unchanged | COMPLETED |
| Pending cancellation/expiry | Unchanged | Decrease | CANCELLED |
| Failed dispatched delivery | Increase | Unchanged | CANCELLED |
| Sellable return | Increase returned units | Unchanged | PARTIALLY_REFUNDED / REFUNDED |
| Damaged return | Unchanged | Unchanged | Damaged movement and return record |

Returns/exchanges reconcile original monetary allocation, stock, cash difference, promotions/redemptions and loyalty in one transaction. Transfers, counts, opening balances and purchase receiving create movements/audits. Retried receiving cannot add stock twice.

## Schema groups

Identity/subscription: plans, tenants, stores, users, sessions, recovery, invitations, invoices and billing events. Catalog/stock: products, variants, media, inventory, movements, transfers, counts, suppliers and purchases. Commerce: orders/item snapshots, returns, coupons, delivery zones and addresses. Customer/membership: programs, tiers, accounts, point lots, rewards, consent, wishlist, campaigns, notifications and push devices/deliveries. Operations/content: registers, cash movements, CMS drafts/publish snapshots, assets, support and tenant/platform audits. Fitting: jobs, usage and credit entries. Email: encrypted outbox.

## Jobs, storage and providers

Production uses Redis rate stores and a BullMQ scheduler with global concurrency one. Each API instance can run a worker; database leases/idempotency remain authoritative. Development runs the same maintenance every 30 seconds in one process. Maintenance releases reservations, expires points/sessions/photos/recovery data, delivers configured messages, advances campaigns/invoices and fitting jobs.

AI submissions with uncertain outcomes are never blindly resubmitted. Push device/message pairs are claimed once and accepted sends are reconciled through provider receipts. Uncertain sends remain recorded without resending. Recovery email retries reuse the provider idempotency key during the short delivery window. Marketing requires current consent.

Public product assets and private fitting photos are separate. Images are decoded, validated, metadata-stripped and normalized. Private results require their owner and expire. The shared media package supports persistent local files and signed private S3 storage behind the same API URLs. Each asset stores its backend and durable upload state/lease; it becomes readable only after storage confirmation. Failed/crashed writes remain hidden and are retried for cleanup. Storage quotas include pending deletion bytes. Cleanup rotates past failed batches and exposes redacted failure counts to maintenance logs. S3 mutations require verified unversioned buckets; conditional writes and bounded/hash-checked reads protect stored references. See STORAGE.md.

Maintenance-only migration verifies public local/cloud bytes before changing backend references under the tenant lock; local originals remain intact and private-photo expiry is preserved. Encrypted backups include confirmed public media from both configured backends and exclude temporary private photos. Isolated restore rebinds assets locally and hides private/interrupted records without contacting the source bucket for mutation.

Fal optionally generates fitting photos; Stripe handles optional SaaS invoice checkout and monthly renewal; Resend handles recovery email; Expo handles push. Secrets stay in the API. Snap's public browser token must be origin-restricted and lenses licensed per product. Provider execution remains disabled until configured and approved.

Recurring enrollments retain consented price snapshots and unique provider subscription identifiers. Signed paid service-period invoices extend access under the tenant lock; provider-invoice uniqueness prevents duplicate activation. Canceled enrollments and stale state events cannot revive renewal. Uncertain provider submissions expire out of the safe retry window and require reconciliation. See BILLING.md for setup and live acceptance boundaries.

Client refetch/polling communicates inventory changes. Socket.IO realtime and offline POS are not claimed.
