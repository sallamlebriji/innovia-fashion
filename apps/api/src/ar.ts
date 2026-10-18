import express from "express";
import { db } from "./db.js";
import { requireFound } from "./errors.js";
import { requireFeature } from "./features.js";
export function arRouter() {
  const router = express.Router();
  router.get("/storefront/:slug/products/:id/ar", async (req, res) => {
    const tenant = requireFound(
      await db.tenant.findUnique({
        where: { slug: String(req.params.slug) },
        select: { id: true },
      }),
    );
    const product = requireFound(
      await db.product.findFirst({
        where: {
          id: String(req.params.id),
          tenantId: tenant.id,
          status: "ACTIVE",
        },
        select: { arLensId: true, arGroupId: true },
      }),
    );
    if (
      process.env.AR_PROVIDER_APPROVED !== "true" ||
      !process.env.CAMERA_KIT_WEB_TOKEN ||
      !product.arLensId ||
      !product.arGroupId
    )
      return res.json({
        enabled: false,
        reason:
          "A licensed product lens and approved Camera Kit account are required.",
        fallback: "PHOTO_TRY_ON",
      });
    await requireFeature(db, tenant.id, "AR");
    // Camera Kit Web tokens are intended for the browser and must be scoped to approved origins in Snap's portal.
    res.json({
      enabled: true,
      provider: "SNAP_CAMERA_KIT",
      apiToken: process.env.CAMERA_KIT_WEB_TOKEN,
      lensId: product.arLensId,
      groupId: product.arGroupId,
    });
  });
  return router;
}
