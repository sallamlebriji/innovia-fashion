# Deployment and operations

Use separate development, staging and production databases. Never seed demo data in production. No production deployment has been performed.

## Hosting

Build all applications from the repository root with npm ci, prisma generate and npm run build. Run API migrations as a release step. The Vite output needs history fallback and an /api/v1 reverse proxy; the development Vite proxy is not a production proxy. Next.js uses STOREFRONT_API_URL for its restricted API proxy.

Dockerfile provides API, storefront and admin targets. deploy/compose.production.yaml expects an external production MySQL and Redis service, HTTPS origins, signing secret and configured persistent local/private S3 media. The admin nginx config proxies to the API. A production ingress must terminate TLS and handle the final domains. Runtime validation refuses insecure origins, missing production Redis or storage configuration, weak signing secrets and local mail transport. See [STORAGE.md](STORAGE.md) for S3 roles, encryption, unversioned private buckets, legacy files and the maintenance migration profile. No live bucket has been configured or accepted.

Use app-scoped MySQL grants/private access and managed backups. Set REDIS_URL to a dedicated Redis 6.2+ service with persistence and noeviction policy. All API instances must share that service. The BullMQ scheduler uses a stable ID and global concurrency one; financial/media/job state remains in MySQL. Development can omit Redis and run one process. Docker's Redis service binds locally on port 6380. The local Docker engine did not become available for a Redis runtime acceptance test; the adapter is typechecked and the production compose requires configuration.

Set TRUST_PROXY_HOPS to the exact trusted ingress count. It must be 0–3, never unrestricted trust. Verify IP handling on the actual hosting platform. Storefront requests currently reach the API through the Next.js proxy and can share a rate-limit IP; ingress-aware distributed per-customer limiting needs validation before scale.

## Optional integrations

All provider secrets stay in the API environment.

| Capability | Required configuration |
| --- | --- |
| Photo fitting | AI_PROVIDER_APPROVED=true and FAL_KEY |
| SaaS invoices/monthly renewal | BILLING_PROVIDER_APPROVED=true, STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET |
| Recovery mail | MAIL_PROVIDER_APPROVED=true, RESEND_API_KEY and MAIL_FROM |
| Expo push | PUSH_PROVIDER_APPROVED=true and EXPO_ACCESS_TOKEN; native EAS project plus APNs/FCM |
| Snap Web AR | AR_PROVIDER_APPROVED=true, origin-scoped CAMERA_KIT_WEB_TOKEN and product lens/group IDs |

Local recovery mail writes short-lived files in .local/emails and expires them. Remove MAIL_TRANSPORT=local in production. Live endpoints do not return invented success when providers are absent.

The Stripe integration supports individual SaaS invoices and consented monthly renewal. Configure the required subscription/invoice webhooks and run provider acceptance from BILLING.md. It does not collect merchant retail payments. Select an eligible Moroccan retail payment provider and obtain its actual merchant/API contract before implementing card collection or electronic refunds. See official [Stripe availability](https://stripe.com/global), [Fal virtual try-on](https://fal.ai/models/fal-ai/image-apps-v2/virtual-try-on/api), [Snap Camera Kit](https://developers.snap.com/camera-kit/home), [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) and [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Backup and release checks

scripts/recovery.mjs supports encrypted database and confirmed public media backup across configured local/S3 stores, integrity verification and restore only into an empty isolated target ending in _restore_test. Temporary private photos are excluded. Restore rebinds assets locally and hides private/interrupted records without mutating the source bucket. Configure a separate 32-byte base64 BACKUP_ENCRYPTION_KEY, the backup folder, MySQL tool paths and explicit isolated restore URLs/directories. Run this tool on the maintenance host with MySQL client utilities; the standard API image does not bundle those utilities. Keep keys separately from backups. Check its usage before execution:

    node scripts/recovery.mjs backup --maintenance-confirmed
    node scripts/recovery.mjs verify <backup-folder>
    node scripts/recovery.mjs restore <backup-folder>

Backups require a real maintenance window that stops writes, including workers. Encryption/tamper-detection tests and the isolated local database/media recovery drill passed. The drill verifies a sale, inventory, movement/audit history and byte-identical media, and refuses an occupied restore target. A live production restore drill has not been performed. Graceful shutdown drains requests/work until its deadline; unfinished leases recover after restart.

Before launch, verify secure cookies on final domains, payment signatures/reconciliation, provider privacy/retention, camera permissions and licensed assets, notification receipts, alerting/log retention, load behavior, accessibility and full intended translations. Resolve/review mobile dependency findings before distribution. These are release checks, not claims of legal or commercial certification.
