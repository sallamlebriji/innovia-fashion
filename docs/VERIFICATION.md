# Verification — 12 October 2026

| Check | Result |
| --- | --- |
| Prisma schema validation | Pass |
| Development/test migrations | Pass |
| Fresh empty database migration sequence | All 17 migrations pass; isolated schema cleanup |
| TypeScript: API, operational app, storefront | Pass |
| ESLint | Pass |
| Vitest: shared validation, MySQL integration, recovery/configuration/rate-limit contract | 127 tests pass in 9 files; latest complete run 170.91 seconds |
| Playwright connected browser workflows | Three pass in 1.9 minutes; English retail/commerce, French/Arabic retail and French/Arabic financial/CRM flows |
| French/Arabic browser acceptance | Pass; catalog editing/import, stock, cash checkout/receipts, register policy/movements/closure, promotions, returns/exchanges, customer profile/notes/value, reports, authentication/recovery, settings/billing, media library and mobile RTL navigation |
| API rate-limit response contract | Pass; excess reads/writes receive structured JSON, HTTP 429, a retry delay and standard headers; a fresh limit window permits writes |
| S3 SDK wire/storage integration | Pass against a local protocol fixture; live bucket/provider acceptance outstanding |
| Public local-to-S3 migration CLI | Pass; verified copies, identical retry adoption, conflict refusal, stable URLs and source/private retention |
| API and Vite production builds | Pass; rerun on 12 October |
| Next.js production build | Pass; preceding verification, source unchanged |
| Native TypeScript | Pass |
| Android and iOS Hermes exports | Pass; dist-validation |
| Encrypted isolated database/media restore | Pass; sale, stock, audits and mixed local/S3 public images restored locally; private/interrupted assets excluded/hidden, source cloud untouched, nonempty target refused |
| Root web/API npm audit | 0 published findings |
| Separate native dependency audit | 18 high findings; release gate documented in MOBILE.md |

Executed locally on Node 24.15.0 and MySQL 8.4.9 with Prisma 6.19.0, Vite 7.3.7, Next.js 16.4.0 and Expo 57 / React Native 0.86.3. Lockfiles are authoritative. The root Camera Kit UUID dependency uses a compatible override and builds successfully; live lens execution remains unverified.

## Automated business evidence

Tests exercise tenant foreign keys/permissions, transactional stock and overselling protection, idempotency/retry conflicts, product quotas/import validation, transfers/counts/receiving, partial/full returns/exchanges and money allocation, cash registers/promotions, delivery reservations/dispatch/expiry, customer web/native scopes/privacy, loyalty lots/tier/birthday/referral reconciliation, private media, CMS drafts/previews/schedules, staff/subscription/support, AI job leases/uncertain submissions/credits and signed billing events.

New checks verify atomic bulk prices and zero-stock draft duplication, correlated backend filters/price ordering/facets, feature enforcement with financial closure, historical cost snapshots and tax-exclusive margins, chart-based footwear guidance, unpublished design isolation, single-use recovery with session revocation, consented push claims/receipts without uncertain resends, protected operator controls and safe quota reductions. A regression confirms referral reversals still work after loyalty entitlement is removed, including zero-point original sales.

Recurring-billing checks cover consented and idempotent enrollment, plan quotas, exact monthly paid-invoice validation, duplicate/out-of-order events, suspension protection, failed payments, cancellation, and uncertain checkout submissions exceeding the safe retry window. Payment pages and portal operations remain unverified against a live provider.

Cryptographic recovery tests detect tampered/wrong-key backups. Production configuration tests reject insecure/missing infrastructure, local mail and ambiguous proxy trust. Integration fixtures use only the isolated test database; browser fixtures are uniquely named and cleaned up.

Storage tests send real AWS SDK requests to a local S3 protocol fixture and check conditional/encrypted uploads, private access, bounded/integrity-checked reads, pagination, unversioned-bucket requirements, persisted upload leases before provider writes, expired/interrupted cleanup, provider deletion failures and quota retention. A failed cloud batch does not monopolize subsequent local-photo cleanup. Conditional-write rejection never deletes the pre-existing object. Migration tests execute the actual maintenance CLI, verify source/remote bytes before backend switching, adopt identical retry copies and reject conflicting data while retaining local originals and private-photo expiry. Mixed-store backups deduplicate identical copies, reject missing/conflicting public media and exclude temporary photos. This establishes adapter behavior, not real provider/account acceptance.

The Windows recovery drill creates isolated task-owned schemas and files, applies all seventeen migrations, records a two-unit retail sale, encrypts and verifies a mixed local/S3 database/media backup, and restores it into an empty target. The restored order totals MAD 240.00, inventory is three units, two stock movements and audit history remain, and both public image SHA-256 values match the original. Private and incomplete images are absent from restored files; their metadata is hidden, leases are cleared and every backend is rebound locally. No source S3 object is deleted or changed by restore. A second restore into the nonempty database is refused. The task-owned schemas/files are removed after verification. This validates the local tools; it does not establish production recovery time or provider backup reliability.

## Browser evidence

The acceptance flow registers a merchant, creates/adjusts stock, uploads and displays a normalized image, attaches its managed URL to a product and verifies reference protection, completes a promoted cash sale, verifies actual reports and drawer balances, publishes content/typography/spacing/footer controls, uses real brand/price filters, makes a pickup reservation, verifies shared stock, creates a customer account and inbox campaign, invites staff, requests recovery, and checks desktop/mobile/dark/Arabic navigation with no page JavaScript errors.

Screenshots are local ignored artifacts under .local. Reports, the responsive boutique, Arabic recovery/mobile billing, uploaded-image library and Arabic mobile media page were visually reviewed. The localization script also opens and closes mobile navigation, checks its expanded state, and verifies that the closed sidebar is hidden. The additional preview script checks recovery layout and operator control tables. Inventory synchronization uses refetch/polling, not Socket.IO.

The additional localized retail test creates an isolated merchant and a mixed French/Arabic product name containing literal `$&`, edits DRAFT/ACTIVE status, saves a size chart and VIDEO gallery reference, then validates and imports a canonical CSV in French. In Arabic, it rejects a negative-stock adjustment and an overselling checkout with translated errors, receives two units with an unchanged Arabic reason, and records exactly one cash sale for MAD 240.50. Four units remain; enum values, SKUs, gallery descriptions, product names and the stable walk-in customer record are preserved. Receipt money uses the Arabic Moroccan locale. Arabic singular/dual quantities, persisted language after reload, left-to-right SKU entry and mobile dialog/page overflow are checked. Product form, POS, receipt and movement screenshots were visually reviewed. Each browser fixture is removed through the shared guarded tenant cleanup helper. No live gallery video or external provider is exercised by the fixture URL.

The localized financial test creates a second isolated merchant. French promotion setup rejects an invalid percentage/date range with translated backend validation messages, then persists a FIXED/POS promotion for MAD 50.00 and checks pause/reactivation. A MAD 100.00 drawer receives MAD 25.00 and pays MAD 10.00; an unsupported MAD 1,000.00 withdrawal is rejected without a movement. A two-unit promoted sale totals MAD 431.00 and raises cash to MAD 546.00. An Arabic partial return refunds MAD 215.50, then a French exchange collects MAD 84.50 for a MAD 300.00 replacement. Customer net value updates from MAD 431.00 to MAD 215.50 and finally MAD 300.00; private mixed-language notes containing `$&` remain unchanged. Arabic drawer closure records MAD 415.00 counted/expected cash and zero variance. Exactly seven movements retain their canonical types, the original order is refunded for MAD 431.00, original-item stock returns to three and replacement stock falls to two. Return reasons and customer content are preserved. Arabic mobile return/profile/register/promotion screens have no horizontal overflow; screenshots were visually reviewed. No live payment or courier is involved.

After these changes, root TypeScript and ESLint checks passed, the complete 127-test backend/storage suite and all three Playwright workflows passed, and the existing localization script passed again. API and merchant production builds passed; the merchant entry chunk is 498.12 kB with the financial vocabulary loaded separately. The unchanged Next/native builds, migration/recovery drills and dependency audits above are results from the preceding verification; they were not rerun for merchant wording and API error-response changes. Browser fixture cleanup was checked; an interrupted prior fixture was removed only after matching its exact tenant identity and fictitious owner, using the existing guarded helper.

## Verification boundaries

No live payment, AI generation, licensed AR lens, external email/push or production deployment was executed. Native exports are not signed releases or physical-device acceptance. The Redis acceptance script and CI service are configured; the local Docker engine and a Redis runtime are unavailable, so Redis acceptance has not passed locally. Production restore/load drills, hardware beyond keyboard scanner input, comprehensive WCAG review and complete secondary-string translation remain outstanding.

These results establish the delivered local workflows. DELIVERY.md lists remaining provider, native integration and production work without claiming full commercial certification.
