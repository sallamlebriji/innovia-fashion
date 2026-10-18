import express from "express";
import { apiRateLimit } from "./rate-limits.js";
import sharp from "sharp";
import { getMediaStore, MediaStorageError } from "@innovia/media-storage";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth, tenantRequired, permit } from "./auth.js";
import { customerAuth } from "./customer-auth.js";
import { db } from "./db.js";
import { audit, lockTenant, type Actor } from "./retail.js";
import { HttpError, requireFound } from "./errors.js";
import { rateStore } from "./infrastructure.js";
function assetStore(driver: string) {
  if (!["LOCAL", "S3"].includes(driver))
    throw new HttpError(500, "MEDIA_STORAGE", "Invalid stored media backend.");
  return getMediaStore({ ...process.env, MEDIA_STORAGE: driver.toLowerCase() });
}
let processing = 0;
export async function prepareImage(input: Buffer) {
  if (
    !Buffer.isBuffer(input) ||
    input.length < 12 ||
    input.length > 10 * 1024 * 1024
  )
    throw new HttpError(422, "IMAGE_SIZE", "Upload an image up to 10 MB.");
  const jpeg = input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  const png = input
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    input.toString("ascii", 0, 4) === "RIFF" &&
    input.toString("ascii", 8, 12) === "WEBP";
  if (!jpeg && !png && !webp)
    throw new HttpError(
      422,
      "IMAGE_TYPE",
      "Use a real JPEG, PNG, or WebP image. SVG and animated files are not supported.",
    );
  if (processing >= 4)
    throw new HttpError(
      503,
      "IMAGE_BUSY",
      "Image processing is busy. Try again shortly.",
    );
  processing++;
  try {
    const image = sharp(input, {
      limitInputPixels: 24000000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1)
      throw new HttpError(422, "IMAGE_CONTENT", "Use a single still image.");
    return await image
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      422,
      "IMAGE_CONTENT",
      "The image could not be decoded safely. Export a new JPEG or PNG and try again.",
    );
  } finally {
    processing--;
  }
}
export async function validateManagedMedia(
  tx: Prisma.TransactionClient,
  tenantId: string,
  urls: (string | undefined)[],
) {
  const ids = [
    ...new Set(
      urls
        .filter(
          (url): url is string => !!url && url.startsWith("/api/v1/media/"),
        )
        .map((url) => url.split("/").at(-1)!),
    ),
  ];
  if (!ids.length) return;
  const count = await tx.mediaAsset.count({
    where: {
      id: { in: ids },
      tenantId,
      visibility: "PUBLIC",
      storageStatus: "READY",
      deletedAt: null,
      expiresAt: null,
    },
  });
  if (count !== ids.length)
    throw new HttpError(
      422,
      "MEDIA_REFERENCE",
      "Choose an available public image from this boutique’s media library.",
    );
}
export async function saveImage(
  actor: Actor,
  input: Buffer,
  customerId?: string,
  generated = false,
) {
  const output = await prepareImage(input),
    storageKey = `${randomUUID()}.webp`,
    store = getMediaStore();
  // Persist the upload before any remote write. Expired leases are purgeable
  // after crashes or an uncertain provider response, including private photos.
  const asset = await db.$transaction(async (tx) => {
    await lockTenant(tx, actor.tenantId);
    const used = await tx.mediaAsset.aggregate({
      where: { tenantId: actor.tenantId, bytes: { gt: 0 } },
      _sum: { bytes: true },
    });
    const limit =
      Number(process.env.MEDIA_TENANT_LIMIT_MB ?? 250) * 1024 * 1024;
    if (
      !Number.isFinite(limit) ||
      (used._sum.bytes ?? 0) + output.length > limit
    )
      throw new HttpError(
        403,
        "MEDIA_QUOTA",
        "Your boutique’s media storage is full. Remove unused images or contact the operator.",
      );
    const asset = await tx.mediaAsset.create({
      data: {
        tenantId: actor.tenantId,
        name: generated
          ? "Generated fitting preview"
          : customerId
            ? "Private fitting photo"
            : "Boutique image",
        storageKey,
        storageDriver: store.driver.toUpperCase(),
        storageStatus: "UPLOADING",
        uploadLeaseEndsAt: new Date(Date.now() + 120000),
        bytes: output.length,
        mimeType: "image/webp",
        visibility: customerId ? "PRIVATE" : "PUBLIC",
        purpose: generated
          ? "TRY_ON_OUTPUT"
          : customerId
            ? "TRY_ON_INPUT"
            : "CAMPAIGN",
        customerId,
        expiresAt: customerId ? new Date(Date.now() + 86400000) : null,
      },
    });
    await audit(tx, actor, "MEDIA_UPLOAD_STARTED", asset.id, {
      bytes: asset.bytes,
      visibility: asset.visibility,
      ...(customerId && !generated
        ? { consent: "self-photo-v1", retentionHours: 24 }
        : {}),
    });
    return asset;
  });
  try {
    await store.put(storageKey, output);
    await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const ready = await tx.mediaAsset.updateMany({
        where: {
          id: asset.id,
          storageStatus: "UPLOADING",
          deletedAt: null,
          uploadLeaseEndsAt: { gt: new Date() },
        },
        data: { storageStatus: "READY", uploadLeaseEndsAt: null },
      });
      if (!ready.count)
        throw new HttpError(
          409,
          "UPLOAD_EXPIRED",
          "This upload expired. Please upload the image again.",
        );
      await audit(tx, actor, "MEDIA_UPLOADED", asset.id, {
        bytes: asset.bytes,
        visibility: asset.visibility,
        storageDriver: asset.storageDriver,
      });
    });
    return {
      id: asset.id,
      bytes: asset.bytes,
      mimeType: asset.mimeType,
      visibility: asset.visibility,
      expiresAt: asset.expiresAt,
      url: customerId ? undefined : `/api/v1/media/${asset.id}`,
    };
  } catch (error) {
    const conflict =
      (error instanceof MediaStorageError && error.code === "CONFLICT") ||
      (error instanceof Error && "code" in error && error.code === "EEXIST");
    const failed = await db.mediaAsset
      .updateMany({
        where: { id: asset.id, storageStatus: "UPLOADING" },
        data: {
          storageStatus: "FAILED",
          deletedAt: new Date(),
          uploadLeaseEndsAt: null,
          ...(conflict ? { bytes: 0 } : {}),
        },
      })
      .catch(() => ({ count: 0 }));
    // A rejected conditional write never grants ownership of an existing
    // object. Do not delete it as compensation for this failed upload.
    if (failed.count && !conflict) {
      try {
        await store.remove(storageKey);
        await db.mediaAsset.updateMany({
          where: { id: asset.id, storageStatus: "FAILED" },
          data: { bytes: 0 },
        });
      } catch {
        /* The durable tombstone is retried by maintenance. */
      }
    }
    if (conflict)
      throw new HttpError(
        503,
        "MEDIA_STORAGE",
        "This image reference already exists. Please upload the image again.",
      );
    if (error instanceof MediaStorageError)
      throw new HttpError(503, "MEDIA_STORAGE", error.message);
    throw error;
  }
}
export async function readImage(
  tenantId: string,
  id: string,
  customerId?: string,
) {
  const asset = requireFound(
    await db.mediaAsset.findFirst({
      where: {
        tenantId,
        id,
        deletedAt: null,
        storageStatus: "READY",
        ...(customerId
          ? { customerId, visibility: "PRIVATE", expiresAt: { gt: new Date() } }
          : { visibility: "PUBLIC" }),
      },
    }),
  );
  return await assetStore(asset.storageDriver).read(asset.storageKey);
}
let cleanupCursor: string | undefined;
export async function purgeMedia() {
  const now = new Date();
  await db.mediaAsset.updateMany({
    where: { storageStatus: "UPLOADING", uploadLeaseEndsAt: { lte: now } },
    data: { storageStatus: "FAILED", deletedAt: now, uploadLeaseEndsAt: null },
  });
  await db.mediaAsset.updateMany({
    where: { deletedAt: null, storageStatus: "READY", expiresAt: { lte: now } },
    data: { deletedAt: now },
  });
  const pending = {
    deletedAt: { not: null },
    storageStatus: { in: ["READY", "FAILED"] },
    bytes: { gt: 0 },
  };
  let assets = await db.mediaAsset.findMany({
    where: {
      ...pending,
      ...(cleanupCursor ? { id: { gt: cleanupCursor } } : {}),
    },
    take: 25,
    orderBy: { id: "asc" },
  });
  if (!assets.length && cleanupCursor) {
    cleanupCursor = undefined;
    assets = await db.mediaAsset.findMany({
      where: pending,
      take: 25,
      orderBy: { id: "asc" },
    });
  }
  // Rotate past failed records so an unavailable backend cannot monopolize
  // every cleanup batch. The tombstones themselves remain durable in MySQL.
  cleanupCursor = assets.at(-1)?.id;
  let removed = 0,
    failed = 0;
  for (const asset of assets) {
    try {
      await assetStore(asset.storageDriver).remove(asset.storageKey);
    } catch {
      failed++;
      continue;
    }
    await db.mediaAsset.update({ where: { id: asset.id }, data: { bytes: 0 } });
    removed++;
  }
  return { attempted: assets.length, removed, failed };
}
export function mediaRouter() {
  const router = express.Router(),
    manager = permit("OWNER", "MANAGER"),
    uploads = apiRateLimit({
      windowMs: 60000,
      limit: 12,
      ...rateStore("media-uploads"),
    }),
    raw = express.raw({
      type: ["image/jpeg", "image/png", "image/webp"],
      limit: "10mb",
    });
  router.get("/media/:id", async (req, res) => {
    const asset = requireFound(
      await db.mediaAsset.findFirst({
        where: {
          id: String(req.params.id),
          visibility: "PUBLIC",
          deletedAt: null,
          storageStatus: "READY",
        },
      }),
    );
    try {
      res
        .set({
          "Content-Type": asset.mimeType,
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        })
        .send(await assetStore(asset.storageDriver).read(asset.storageKey));
    } catch {
      throw new HttpError(404, "NOT_FOUND", "This image is unavailable.");
    }
  });
  router.get("/media", auth, tenantRequired, async (req, res) => {
    const page = z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse(req.query.page ?? 1),
      where = {
        tenantId: res.locals.actor.tenantId as string,
        visibility: "PUBLIC",
        deletedAt: null,
        storageStatus: "READY",
      };
    const [items, total] = await Promise.all([
      db.mediaAsset.findMany({
        where,
        select: { id: true, bytes: true, mimeType: true, createdAt: true },
        take: 24,
        skip: (page - 1) * 24,
        orderBy: { createdAt: "desc" },
      }),
      db.mediaAsset.count({ where }),
    ]);
    res.json({
      items: items.map((asset) => ({
        ...asset,
        url: `/api/v1/media/${asset.id}`,
      })),
      total,
    });
  });
  router.post(
    "/media",
    auth,
    tenantRequired,
    manager,
    uploads,
    raw,
    async (req, res) =>
      res.status(201).json(await saveImage(res.locals.actor, req.body)),
  );
  router.delete(
    "/media/:id",
    auth,
    tenantRequired,
    manager,
    async (req, res) => {
      const actor: Actor = res.locals.actor,
        id = String(req.params.id),
        url = `/api/v1/media/${id}`;
      await db.$transaction(async (tx) => {
        await lockTenant(tx, actor.tenantId);
        const asset = requireFound(
          await tx.mediaAsset.findFirst({
            where: {
              tenantId: actor.tenantId,
              id,
              visibility: "PUBLIC",
              deletedAt: null,
              storageStatus: "READY",
            },
          }),
        );
        const referenced = await tx.product.count({
          where: {
            tenantId: actor.tenantId,
            OR: [
              { imageUrl: url },
              { tryOnImageUrl: url },
              { media: { some: { url } } },
            ],
          },
        });
        const tenant = await tx.tenant.findUniqueOrThrow({
          where: { id: actor.tenantId },
          select: { heroImage: true },
        });
        const pages = await tx.cMSPage.findMany({
          where: { tenantId: actor.tenantId },
          select: { published: true, sections: { select: { imageUrl: true } } },
        });
        if (
          referenced ||
          tenant.heroImage === url ||
          pages.some(
            (page) =>
              page.sections.some((section) => section.imageUrl === url) ||
              JSON.stringify(page.published).includes(url),
          )
        )
          throw new HttpError(
            409,
            "MEDIA_IN_USE",
            "Remove this image from products and draft/published campaigns before deleting it.",
          );
        await tx.mediaAsset.update({
          where: { id: asset.id },
          data: { deletedAt: new Date() },
        });
        await audit(tx, actor, "MEDIA_DELETED", id, {});
      });
      await purgeMedia();
      res.json({ ok: true });
    },
  );
  const customer = express.Router({ mergeParams: true });
  router.use("/storefront/:slug/customer/media", customer);
  customer.use(async (req, res, next) => {
    res.locals.boutique = requireFound(
      await db.tenant.findUnique({
        where: { slug: String(req.params.slug) },
        select: { id: true },
      }),
    );
    next();
  }, customerAuth);
  customer.post("/", uploads, raw, async (req, res) => {
    if (req.get("X-Photo-Consent") !== "self-photo-v1")
      throw new HttpError(
        422,
        "PHOTO_CONSENT",
        "Confirm that this is your own photo and that you consent to its temporary use.",
      );
    res
      .status(201)
      .json(
        await saveImage(
          res.locals.customerActor,
          req.body,
          res.locals.customerActor.id,
        ),
      );
  });
  customer.get("/:id", async (req, res) => {
    const actor: Actor = res.locals.customerActor,
      asset = requireFound(
        await db.mediaAsset.findFirst({
          where: {
            id: String(req.params.id),
            tenantId: actor.tenantId,
            customerId: actor.id,
            visibility: "PRIVATE",
            deletedAt: null,
            storageStatus: "READY",
            expiresAt: { gt: new Date() },
          },
        }),
      );
    try {
      res
        .set({
          "Content-Type": asset.mimeType,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        })
        .send(await assetStore(asset.storageDriver).read(asset.storageKey));
    } catch {
      throw new HttpError(404, "NOT_FOUND", "This photo is unavailable.");
    }
  });
  customer.delete("/:id", async (req, res) => {
    const actor: Actor = res.locals.customerActor;
    const result = await db.mediaAsset.updateMany({
      where: {
        id: String(req.params.id),
        tenantId: actor.tenantId,
        customerId: actor.id,
        visibility: "PRIVATE",
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    if (!result.count)
      throw new HttpError(404, "NOT_FOUND", "Photo not found.");
    await purgeMedia();
    res.json({ ok: true });
  });
  return router;
}
