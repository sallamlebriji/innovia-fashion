# Media storage and recovery

`@innovia/media-storage` implements local disk and signed S3 object storage through the AWS JavaScript SDK. New uploads use `MEDIA_STORAGE=local` or `s3`; every asset retains its own backend, so changing the default does not break existing local/S3 reads. API media URLs and customer authorization remain the same. No provider credentials, bucket names or direct object URLs are returned to clients.

## Configuration

Local production storage requires an absolute persistent `MEDIA_DIR`. Development defaults to `.local/media`. For S3, set `MEDIA_STORAGE=s3`, `MEDIA_S3_BUCKET` and `MEDIA_S3_REGION`. Prefer an assigned IAM role; optional AWS access key/secret/session-token values belong only in server or maintenance environments. Leave `MEDIA_S3_ENDPOINT` unset for AWS; a custom endpoint must be an HTTPS origin in production. Loopback HTTP is accepted only for development/tests. Path-style addressing is configurable. The prefix defaults to `innovia` and must be dedicated to this application; each deployment needs its own bucket/prefix and database.

Enable the provider's public-access block and keep the bucket private. Use a new bucket where versioning has never been enabled. Every upload and removal checks `GetBucketVersioning` and refuses enabled/suspended versioning or an unverifiable response. This prevents treating a delete marker as confirmed physical removal. AWS documents these semantics in [DeleteObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html) and [GetBucketVersioning](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetBucketVersioning.html). Deny versioning configuration changes to application credentials; operators must preserve this constraint throughout the retention window. Object Lock, replication and independent provider backups must not retain fitting photos beyond the approved policy.

Server-side encryption defaults to `AES256`. `aws:kms` requires `MEDIA_S3_KMS_KEY_ID` and the appropriate KMS permissions/key policy. Use `provider` only after confirming equivalent provider-managed encryption. Adapt [the IAM policy example](../deploy/media-iam-policy.example.json) to the real bucket/prefix; it grants no public ACL or bucket administration. A compatible provider must support signature v4, bucket-versioning inspection, conditional PUT, object metadata and paginated listings. Compatibility with an arbitrary provider is not established by a local fixture.

## Upload and cleanup behavior

Images are decoded, stripped of metadata and converted to bounded WebP files. A tenant lock checks the storage quota and persists an `UPLOADING` ledger record with a two-minute lease before writing bytes. Uploads become `READY` only after storage confirmation and the final database transaction. Failed/interrupted objects remain hidden and their persistent cleanup records survive restarts. `If-None-Match: *` prevents replacing an existing S3 reference. SDK requests use one attempt: uncertain writes remain recorded for cleanup, while explicit conditional conflicts never grant ownership and never delete the existing object. Reads have size, transport-time and SHA-256 integrity bounds.

Private photos require current customer authentication and upload consent, use `no-store`, and become inaccessible at their original 24-hour expiry. Maintenance attempts physical cleanup on its normal schedule; provider outages retain a pending cleanup record and charged bytes until deletion succeeds. This is an expiry boundary plus retryable cleanup, not a guarantee that a failing provider deletes bytes at an exact second. Monitor maintenance failures, positive-byte deleted assets and storage usage. Production instances share the required Redis/BullMQ maintenance service. A filesystem volume containing legacy photos must remain attached until their cleanup completes.

## Moving existing public images

Apply database migrations, take a verified backup, stop application writes and workers, configure the existing `MEDIA_DIR` together with the S3 target, then run:

    npm run media:migrate -- --maintenance-confirmed
    npm run media:migrate -- --maintenance-confirmed --tenant <tenant-id>

The production compose also supplies the `migrate-media` maintenance profile. Stop API workers before invoking that service. The command copies public, live, confirmed local images, reads each remote copy back, verifies its SHA-256 and ledger size, then switches the asset backend under a tenant lock with an audit record. Identical copies from an interrupted attempt are accepted; conflicting copies stop the migration without replacing either file. Private, expired, deleted and incomplete uploads are excluded. Existing API URLs remain stable. Local originals are retained for recovery and require a separate reviewed retention/removal process; this command never deletes them. Repeated execution is idempotent for completed records. Keep the local volume while any local private/pending asset remains. Never repoint an existing S3 backend to a different bucket/prefix while it still holds assets.

## Encrypted backup and isolated restore

The maintenance-only recovery tool snapshots the database and confirmed public media from configured local/S3 stores. It intentionally excludes temporary private photos and incomplete/deleted objects. A missing required public file or conflicting local/cloud copy aborts completion. Database, images and manifest are separately authenticated/encrypted with AES-256-GCM; keep the 32-byte key away from the backup. Database snapshots still contain customer/account metadata and require an approved retention/access policy.

    node scripts/recovery.mjs backup --maintenance-confirmed
    node scripts/recovery.mjs verify <backup-folder>
    node scripts/recovery.mjs restore <backup-folder>

Restore accepts only empty isolated `_restore_test` targets. Restored assets are rebound to the isolated local media directory; private/interrupted assets are hidden and upload leases are cleared. The restore tool never writes or deletes in the source bucket. Use the restored database and `MEDIA_DIR` with local storage for acceptance. A recovery into a real production service requires a separate reviewed promotion step.

## Verification boundary

Automated tests use actual AWS SDK requests against a local HTTP S3 protocol fixture, including signatures, conditional writes, pagination, versioning restrictions, ownership/consent, interrupted uploads, provider failures, quota cleanup, migration retries/conflicts and encrypted mixed-store backup. The isolated MySQL recovery drill restores local/S3 public image bytes and excludes private photos. These checks do not establish live account permissions, region/privacy eligibility, encryption configuration, provider compatibility, production backup reliability or deletion behavior. Complete those acceptance checks against the selected private bucket before launch.
