import { createHash } from "node:crypto";
import {
  createMediaStore,
  MediaStorageError,
  type StorageEnvironment,
} from "@innovia/media-storage";
import { db } from "./db.js";
import { audit, lockTenant } from "./retail.js";

// Invoke only with application writes and workers stopped. Temporary private
// photos stay on their original backend until their normal expiry/purge.
export async function migratePublicMediaToS3(
  env: StorageEnvironment = process.env,
  tenantId?: string,
) {
  if (env.MEDIA_STORAGE !== "s3" || !env.MEDIA_DIR)
    throw new MediaStorageError(
      "CONFIG",
      "Select S3 storage and supply the existing MEDIA_DIR first.",
    );
  const local = createMediaStore({ ...env, MEDIA_STORAGE: "local" }),
    cloud = createMediaStore(env),
    hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
  let cursor: string | undefined,
    migrated = 0,
    skipped = 0;
  try {
    while (true) {
      const assets = await db.mediaAsset.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          storageDriver: "LOCAL",
          storageStatus: "READY",
          visibility: "PUBLIC",
          deletedAt: null,
          expiresAt: null,
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        take: 50,
        orderBy: { id: "asc" },
      });
      if (!assets.length) break;
      for (const asset of assets) {
        cursor = asset.id;
        const data = await local.read(asset.storageKey),
          checksum = hash(data);
        if (data.length !== asset.bytes)
          throw new MediaStorageError(
            "INTEGRITY",
            "A local media file differs from its ledger size; migration stopped.",
          );
        try {
          await cloud.put(asset.storageKey, data);
        } catch (error) {
          if (
            !(error instanceof MediaStorageError) ||
            error.code !== "CONFLICT"
          )
            throw error;
          // A previous attempt may have written the object before its database
          // transaction failed. Adopt only an identical, independently read copy.
        }
        if (hash(await cloud.read(asset.storageKey)) !== checksum)
          throw new MediaStorageError(
            "INTEGRITY",
            "A cloud media copy differs from the local source; migration stopped.",
          );
        const changed = await db.$transaction(async (tx) => {
          await lockTenant(tx, asset.tenantId);
          const result = await tx.mediaAsset.updateMany({
            where: {
              id: asset.id,
              tenantId: asset.tenantId,
              storageKey: asset.storageKey,
              storageDriver: "LOCAL",
              storageStatus: "READY",
              bytes: asset.bytes,
              visibility: "PUBLIC",
              deletedAt: null,
              expiresAt: null,
            },
            data: { storageDriver: "S3" },
          });
          if (result.count)
            await audit(
              tx,
              {
                tenantId: asset.tenantId,
                id: "media-migration-cli",
                role: "PLATFORM_ADMIN",
              },
              "MEDIA_STORAGE_MIGRATED",
              asset.id,
              {
                from: "LOCAL",
                to: "S3",
                bytes: asset.bytes,
                sha256: checksum,
                sourceRetained: true,
              },
            );
          return result.count;
        });
        if (changed) migrated++;
        else skipped++;
      }
    }
    return { migrated, skipped, sourceFilesRetained: true };
  } finally {
    local.close();
    cloud.close();
  }
}
