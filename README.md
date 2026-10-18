# INNOVIA FASHION OS

A connected TypeScript/MySQL fashion retail platform with merchant operations, POS, boutique commerce, customer loyalty, a native app and optional provider integrations. See [delivery status](docs/DELIVERY.md) for the complete scope and remaining release work.

## Run locally

Requires Node 24 and MySQL 8.4. Install from the locked dependencies:

    npm ci
    npm run db:local
    npm run db:generate
    npm run db:migrate
    npm run db:seed
    node scripts/configure-local.mjs
    node scripts/migrate-test.mjs
    npm run dev

The Windows helper provisions only this project's .local/mysql-data instance. Alternatively configure .env from .env.example and use your own isolated development/test databases. Docker development services are in compose.yaml. Redis is optional for single-process development and required in production.

| Experience | Local address |
| --- | --- |
| Merchant dashboard, POS and platform | http://localhost:5174 |
| ATELIER NOIR | http://localhost:3000/atelier-noir |
| URBAN SOLE | http://localhost:3000/urban-sole |
| MODA STUDIO | http://localhost:3000/moda-studio |
| API / OpenAPI | http://127.0.0.1:4001/api/v1/health · /api/v1/openapi.json |

Demo owners are atelier-noir@demo.innovia.local, urban-sole@demo.innovia.local and moda-studio@demo.innovia.local. Use DEMO_PASSWORD from the ignored .env. Platform credentials use BOOTSTRAP_ADMIN_EMAIL/PASSWORD. No secret is embedded in a client. New merchants can register from the sign-in screen. Demo data and imagery are fictional/illustrative; never seed production.

## Connected functionality

- Tenant identity, staff invitations/roles, revocation, private recovery links, usage limits, operator controls, audits, support, invoices and consented monthly subscription renewal.
- Products/variants/metadata/media, CSV import/export, duplication, bulk prices, stores/warehouses, movements, transfers, counts, suppliers and purchase receiving.
- Cash POS, scanner input, promotions, registers/cash movements, receipts, partial returns and exchanges with transactional stock/payment/loyalty reconciliation.
- Server-rendered boutiques, real filters/facets, product pages, bag/wishlist, pickup/COD checkout, addresses, configured tax/delivery, reservation expiry and tracking.
- Controlled content sections, drafts/previews/publishing, schedules, SEO and branding/layout/navigation controls.
- Membership QR, points/tiers/rewards/expiry, birthday/referral rules, customer preferences and consented campaigns.
- Native onboarding, discovery, catalog, bag/checkout, accounts, loyalty, privacy, camera/photo fitting and push registration.
- Optional Fal photo jobs, Snap Web AR, product-chart size guidance, Stripe SaaS invoice/renewal checkout, Resend recovery email and Expo push.
- Local/private S3 image storage, upload leases, crash cleanup, verified public-image migration and encrypted mixed-store recovery with temporary fitting photos excluded.

## Verify

    node scripts/migrate-test.mjs
    npm run typecheck
    npm run lint
    npm test
    npm run build
    npx playwright test

Browser acceptance needs the three apps running and Chrome/Playwright Chromium. Set CHROME_PATH for an installed browser when needed. Integration tests require a separate database ending in _test and clean their own fixtures. The Windows fresh-migration check is node scripts/verify-fresh-migrations.mjs. The isolated encrypted restore drill is node --import tsx scripts/verify-recovery-drill.mjs. Redis acceptance is node --import tsx scripts/verify-redis.mjs against empty local database 15; CI supplies Redis. French/Arabic browser checks use node scripts/verify-localization.mjs. Native installation/checks are described in [MOBILE.md](docs/MOBILE.md).

## Repository and documentation

| Directory | Responsibility |
| --- | --- |
| apps/api | Express services, auth, jobs and integrations |
| apps/merchant-admin | Merchant, POS and platform routes |
| apps/storefront | Next.js boutiques and customer commerce |
| apps/mobile | Independently locked Expo app |
| packages | Contracts, validation, requests, tokens and primitives |
| prisma | Schema, migrations and demo seed |
| tests / scripts | Checks, browser flows, setup and recovery |
| docs / deploy | Specification, delivery evidence and hosting configs |

Merchant, POS and operator interfaces share the Vite app with separate layouts/permissions. Storefront and native experiences are separate.

Read [architecture](docs/ARCHITECTURE.md), [API contracts](docs/API.md), [verification](docs/VERIFICATION.md), [localization](docs/LOCALIZATION.md), [deployment](docs/DEPLOYMENT.md), [storage](docs/STORAGE.md), [design](docs/DESIGN.md) and the preserved [original specification](docs/PRODUCT_SPEC.md).

## Release limits

Live provider accounts, hosting, signing and physical devices are not configured. Retail card checkout/refunds, embedded native AR, offline POS, full secondary-string translation and a released mobile app remain outside the delivered local workflows. Automatic monthly renewal is implemented but requires eligible provider sandbox/live acceptance; see BILLING.md. Mobile dependency advisories are recorded in MOBILE.md. Conversion/abandonment reports require consented tracking. Private S3 storage and mixed-store recovery are implemented and tested locally; live provider/bucket acceptance remains required. See DELIVERY.md for precise phase coverage.


