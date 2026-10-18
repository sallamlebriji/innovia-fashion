import express from "express";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth, tenantRequired, permit } from "./auth.js";
import { customerAuth } from "./customer-auth.js";
import { db } from "./db.js";
import { command, audit, lockTenant, type Actor } from "./retail.js";
import { HttpError, requireFound } from "./errors.js";
import { requireSubscription } from "./subscription.js";
import { requireFeature } from "./features.js";
import {
  readImage,
  saveImage,
  purgeMedia,
  validateManagedMedia,
} from "./media.js";
import {
  tryOnConfigured,
  liveTryOnProvider,
  type TryOnProvider,
} from "./providers/try-on.js";
const inputSchema = z.object({
  productId: z.string().min(1),
  photoId: z.string().min(1),
  consent: z.literal(true),
  adult: z.literal(true),
});
const jobSelect = {
  id: true,
  productId: true,
  photoId: true,
  outputId: true,
  status: true,
  errorCode: true,
  creditedBack: true,
  expiresAt: true,
  createdAt: true,
} as const;
export async function enqueueTryOn(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: z.infer<typeof inputSchema>,
  available: boolean,
) {
  if (!available)
    throw new HttpError(
      503,
      "AI_UNCONFIGURED",
      "Virtual fitting is not configured for this platform.",
    );
  await requireSubscription(tx, actor.tenantId);
  await requireFeature(tx, actor.tenantId, "AI");
  const tenant = requireFound(
    await tx.tenant.findUnique({
      where: { id: actor.tenantId },
      include: { plan: true },
    }),
  );
  if (!tenant.tryOnEnabled || tenant.plan.aiCredits < 1)
    throw new HttpError(
      403,
      "AI_DISABLED",
      "Virtual fitting is not enabled for this boutique and plan.",
    );
  const product = requireFound(
    await tx.product.findFirst({
      where: {
        tenantId: actor.tenantId,
        id: input.productId,
        status: "ACTIVE",
        tryOnEnabled: true,
      },
    }),
  );
  if (!product.tryOnImageUrl)
    throw new HttpError(
      422,
      "GARMENT_ASSET",
      "The boutique must supply a verified garment image.",
    );
  await validateManagedMedia(tx, actor.tenantId, [product.tryOnImageUrl]);
  const photo = requireFound(
    await tx.mediaAsset.findFirst({
      where: {
        tenantId: actor.tenantId,
        id: input.photoId,
        customerId: actor.id,
        visibility: "PRIVATE",
        purpose: "TRY_ON_INPUT",
        storageStatus: "READY",
        deletedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
  );
  const period = new Date().toISOString().slice(0, 7);
  if (
    await tx.tryOnJob.count({
      where: { tenantId: actor.tenantId, photoId: photo.id, deletedAt: null },
    })
  )
    throw new HttpError(
      409,
      "PHOTO_IN_USE",
      "Upload a separate photo for each fitting preview.",
    );
  const usage = await tx.aIUsage.upsert({
    where: { tenantId_period: { tenantId: actor.tenantId, period } },
    create: { tenantId: actor.tenantId, period },
    update: {},
  });
  if (usage.used >= tenant.plan.aiCredits)
    throw new HttpError(
      403,
      "AI_CREDIT_LIMIT",
      "This boutique’s virtual fitting allowance has been used for this month.",
    );
  if (
    (await tx.tryOnJob.count({
      where: {
        tenantId: actor.tenantId,
        customerId: actor.id,
        deletedAt: null,
        status: { in: ["QUEUED", "SUBMITTING", "PROCESSING"] },
      },
    })) >= 2
  )
    throw new HttpError(
      429,
      "AI_ACTIVE_LIMIT",
      "Wait for your current fitting previews to finish.",
    );
  const job = await tx.tryOnJob.create({
    data: {
      tenantId: actor.tenantId,
      customerId: actor.id,
      productId: product.id,
      photoId: photo.id,
      garmentUrl: product.tryOnImageUrl,
      period,
      consentVersion: "fal-self-photo-adult-v1",
      expiresAt: photo.expiresAt!,
    },
    select: jobSelect,
  });
  await tx.aIUsage.update({
    where: { id: usage.id },
    data: { used: { increment: 1 } },
  });
  await tx.aICreditEntry.create({
    data: {
      tenantId: actor.tenantId,
      jobId: job.id,
      period,
      type: "CHARGE",
      credits: 1,
    },
  });
  await audit(tx, actor, "TRY_ON_REQUESTED", job.id, {
    consentVersion: "fal-self-photo-adult-v1",
    provider: "FAL",
    credits: 1,
  });
  return job;
}
async function failJob(id: string, lease: string, errorCode: string) {
  const found = await db.tryOnJob.findUnique({ where: { id } });
  if (!found) return;
  await db.$transaction(async (tx) => {
    await lockTenant(tx, found.tenantId);
    const job = await tx.tryOnJob.findUniqueOrThrow({ where: { id } });
    if (
      job.leaseToken !== lease ||
      ["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)
    )
      return;
    if (!job.creditedBack) {
      await tx.aIUsage.update({
        where: {
          tenantId_period: { tenantId: job.tenantId, period: job.period },
        },
        data: { used: { decrement: 1 } },
      });
      await tx.aICreditEntry.create({
        data: {
          tenantId: job.tenantId,
          jobId: job.id,
          period: job.period,
          type: "REFUND",
          credits: -1,
        },
      });
    }
    await tx.tryOnJob.update({
      where: { id },
      data: {
        status: "FAILED",
        errorCode,
        creditedBack: true,
        leaseToken: null,
        leaseUntil: null,
      },
    });
    await audit(
      tx,
      { tenantId: job.tenantId, id: "system", role: "OWNER" },
      "TRY_ON_FAILED",
      id,
      { errorCode, creditRefunded: true },
    );
  });
}
export async function runTryOnJobs(
  provider: TryOnProvider | null = liveTryOnProvider(),
) {
  const now = new Date();
  const candidates = await db.tryOnJob.findMany({
    where: {
      deletedAt: null,
      status: { in: ["QUEUED", "SUBMITTING", "PROCESSING"] },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    },
    take: 5,
    orderBy: { createdAt: "asc" },
  });
  for (const candidate of candidates) {
    const lease = randomUUID();
    const job = await db.$transaction(async (tx) => {
      await lockTenant(tx, candidate.tenantId);
      const current = await tx.tryOnJob.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      if (
        current.deletedAt ||
        !["QUEUED", "SUBMITTING", "PROCESSING"].includes(current.status) ||
        (current.leaseUntil && current.leaseUntil > new Date())
      )
        return null;
      return tx.tryOnJob.update({
        where: { id: current.id },
        data: {
          leaseToken: lease,
          leaseUntil: new Date(Date.now() + 120000),
          ...(current.status === "QUEUED" ? { status: "SUBMITTING" } : {}),
        },
      });
    });
    if (!job) continue;
    if (
      !(await db.mediaAsset.count({
        where: {
          tenantId: job.tenantId,
          id: job.photoId,
          storageStatus: "READY",
          deletedAt: null,
          expiresAt: { gt: new Date() },
        },
      }))
    ) {
      if (job.providerRequestId)
        await provider?.cancel(job.providerRequestId).catch(() => {});
      await failJob(job.id, lease, "PHOTO_UNAVAILABLE");
      continue;
    }
    if (!provider) {
      await failJob(job.id, lease, "PROVIDER_DISABLED");
      continue;
    }
    if (
      job.expiresAt <= now ||
      job.createdAt < new Date(Date.now() - 20 * 60000)
    ) {
      if (job.providerRequestId)
        await provider.cancel(job.providerRequestId).catch(() => {});
      await failJob(job.id, lease, "TIMEOUT");
      continue;
    }
    if (candidate.status === "SUBMITTING" && !job.providerRequestId) {
      await failJob(job.id, lease, "SUBMISSION_UNCERTAIN");
      continue;
    }
    try {
      if (!job.providerRequestId) {
        const photo = await readImage(
          job.tenantId,
          job.photoId,
          job.customerId,
        );
        const clothing = job.garmentUrl.startsWith("/api/v1/media/")
          ? `data:image/webp;base64,${(await readImage(job.tenantId, job.garmentUrl.split("/").at(-1)!)).toString("base64")}`
          : job.garmentUrl;
        const requestId = await provider.submit(photo, clothing);
        const updated = await db.tryOnJob.updateMany({
          where: { id: job.id, leaseToken: lease, deletedAt: null },
          data: {
            providerRequestId: requestId,
            status: "PROCESSING",
            leaseToken: null,
            leaseUntil: null,
          },
        });
        if (!updated.count) await provider.cancel(requestId).catch(() => {});
        continue;
      }
      const status = await provider.status(job.providerRequestId);
      if (status === "PENDING") {
        await db.tryOnJob.updateMany({
          where: { id: job.id, leaseToken: lease },
          data: { leaseToken: null, leaseUntil: null },
        });
        continue;
      }
      const output = await saveImage(
        { tenantId: job.tenantId, id: job.customerId, role: "CASHIER" },
        await provider.result(job.providerRequestId),
        job.customerId,
        true,
      );
      const updated = await db.tryOnJob.updateMany({
        where: { id: job.id, leaseToken: lease, deletedAt: null },
        data: {
          outputId: output.id,
          status: "COMPLETED",
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (!updated.count)
        await db.mediaAsset.update({
          where: { id: output.id },
          data: { deletedAt: new Date() },
        });
      else
        await db.mediaAsset.update({
          where: { id: output.id },
          data: { expiresAt: job.expiresAt },
        });
    } catch (error) {
      await failJob(
        job.id,
        lease,
        error instanceof HttpError ? error.code : "PROVIDER_FAILURE",
      );
    }
  }
  await db.tryOnJob.updateMany({
    where: {
      deletedAt: null,
      expiresAt: { lte: now },
      status: { in: ["COMPLETED", "FAILED", "CANCELLED"] },
    },
    data: { deletedAt: now },
  });
}
export function tryOnRouter() {
  const router = express.Router();
  router.get("/storefront/:slug/try-on", async (req, res) => {
    const tenant = requireFound(
      await db.tenant.findUnique({
        where: { slug: String(req.params.slug) },
        select: {
          tryOnEnabled: true,
          plan: { select: { aiCredits: true, features: true } },
        },
      }),
    );
    res.json({
      enabled:
        tryOnConfigured() &&
        tenant.tryOnEnabled &&
        tenant.plan.aiCredits > 0 &&
        (!Array.isArray(tenant.plan.features) ||
          tenant.plan.features.includes("AI")),
      provider: "FAL",
      retentionHours: 24,
      consentVersion: "fal-self-photo-adult-v1",
    });
  });
  router.use("/ai", auth, tenantRequired);
  router.get("/ai", async (_req, res) => {
    const tenantId: string = res.locals.actor.tenantId,
      period = new Date().toISOString().slice(0, 7);
    const [tenant, usage, jobs] = await Promise.all([
      db.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { tryOnEnabled: true, plan: { select: { aiCredits: true } } },
      }),
      db.aIUsage.findUnique({
        where: { tenantId_period: { tenantId, period } },
      }),
      db.tryOnJob.groupBy({
        by: ["status"],
        where: { tenantId, period },
        _count: true,
      }),
    ]);
    res.json({
      enabled: tenant.tryOnEnabled,
      providerConfigured: tryOnConfigured(),
      credits: tenant.plan.aiCredits,
      used: usage?.used ?? 0,
      period,
      jobs,
    });
  });
  router.put("/ai", permit("OWNER", "MANAGER"), async (req, res) => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body),
      actor: Actor = res.locals.actor;
    if (enabled && !tryOnConfigured())
      throw new HttpError(
        503,
        "AI_UNCONFIGURED",
        "The operator must configure and approve the provider before enabling virtual fitting.",
      );
    res.json(
      await db.$transaction(async (tx) => {
        await lockTenant(tx, actor.tenantId);
        const result = await tx.tenant.update({
          where: { id: actor.tenantId },
          data: { tryOnEnabled: enabled },
          select: { tryOnEnabled: true },
        });
        await audit(tx, actor, "TRY_ON_CONFIGURED", actor.tenantId, {
          enabled,
        });
        return result;
      }),
    );
  });
  const customer = express.Router({ mergeParams: true });
  router.use("/storefront/:slug/customer/try-on", customer);
  customer.use(async (req, res, next) => {
    res.locals.boutique = requireFound(
      await db.tenant.findUnique({
        where: { slug: String(req.params.slug) },
        select: { id: true },
      }),
    );
    next();
  }, customerAuth);
  customer.get("/", async (_req, res) => {
    const actor: Actor = res.locals.customerActor;
    res.json(
      await db.tryOnJob.findMany({
        where: {
          tenantId: actor.tenantId,
          customerId: actor.id,
          deletedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: jobSelect,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  });
  customer.post("/", async (req, res) => {
    const input = inputSchema.parse(req.body),
      actor: Actor = res.locals.customerActor;
    res
      .status(202)
      .json(
        await command(
          actor,
          req.get("Idempotency-Key"),
          { type: "try-on", ...input },
          (tx) => enqueueTryOn(tx, actor, input, tryOnConfigured()),
        ),
      );
  });
  customer.delete("/:id", async (req, res) => {
    const actor: Actor = res.locals.customerActor;
    const job = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const current = requireFound(
        await tx.tryOnJob.findFirst({
          where: {
            tenantId: actor.tenantId,
            customerId: actor.id,
            id: String(req.params.id),
            deletedAt: null,
          },
        }),
      );
      if (current.status === "QUEUED" && !current.creditedBack) {
        await tx.aIUsage.update({
          where: {
            tenantId_period: {
              tenantId: current.tenantId,
              period: current.period,
            },
          },
          data: { used: { decrement: 1 } },
        });
        await tx.aICreditEntry.create({
          data: {
            tenantId: current.tenantId,
            jobId: current.id,
            period: current.period,
            type: "REFUND",
            credits: -1,
          },
        });
      }
      await tx.mediaAsset.updateMany({
        where: {
          tenantId: actor.tenantId,
          customerId: actor.id,
          id: {
            in: [
              current.photoId,
              ...(current.outputId ? [current.outputId] : []),
            ],
          },
        },
        data: { deletedAt: new Date() },
      });
      return tx.tryOnJob.update({
        where: { id: current.id },
        data: {
          deletedAt: new Date(),
          ...(current.status === "QUEUED"
            ? { status: "CANCELLED", creditedBack: true }
            : {}),
          leaseToken: null,
          leaseUntil: null,
        },
      });
    });
    if (job.providerRequestId)
      await liveTryOnProvider()
        ?.cancel(job.providerRequestId)
        .catch(() => {});
    await purgeMedia();
    res.json({ ok: true });
  });
  return router;
}
export async function deleteCustomerTryOn(
  tx: Prisma.TransactionClient,
  actor: Actor,
) {
  const jobs = await tx.tryOnJob.findMany({
    where: { tenantId: actor.tenantId, customerId: actor.id, deletedAt: null },
  });
  for (const job of jobs) {
    if (job.status === "QUEUED" && !job.creditedBack) {
      await tx.aIUsage.update({
        where: {
          tenantId_period: { tenantId: actor.tenantId, period: job.period },
        },
        data: { used: { decrement: 1 } },
      });
      await tx.aICreditEntry.create({
        data: {
          tenantId: actor.tenantId,
          jobId: job.id,
          period: job.period,
          type: "REFUND",
          credits: -1,
        },
      });
    }
    await tx.tryOnJob.update({
      where: { id: job.id },
      data: {
        deletedAt: new Date(),
        leaseToken: null,
        leaseUntil: null,
        ...(job.status === "QUEUED"
          ? { status: "CANCELLED", creditedBack: true }
          : {}),
      },
    });
  }
  return jobs.flatMap((job) =>
    job.providerRequestId ? [job.providerRequestId] : [],
  );
}
