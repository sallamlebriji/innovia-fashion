import express from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { planSchema, registerSchema } from "@innovia/validation";
import { db } from "./db.js";
import { auth, permit, hashPassword } from "./auth.js";
import { audit, lockTenant } from "./retail.js";
import { featureNames } from "./features.js";
import { HttpError, requireFound } from "./errors.js";
import { billingConfigured } from "./providers/billing.js";
import { tryOnConfigured } from "./providers/try-on.js";
import { emailConfigured } from "./email.js";
export function platformControlRouter() {
  const router = express.Router();
  router.use("/platform/control", auth, permit("PLATFORM_ADMIN"));
  router.get("/platform/control", async (_req, res) => {
    const [stores, users, auditLogs, aiUsage, jobs, mail, platformAudit] =
      await Promise.all([
        db.store.findMany({
          take: 200,
          include: { tenant: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        }),
        db.user.findMany({
          where: { role: "PLATFORM_ADMIN" },
          select: {
            id: true,
            name: true,
            email: true,
            active: true,
            createdAt: true,
          },
        }),
        db.auditLog.findMany({
          take: 100,
          include: { tenant: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        }),
        db.aIUsage.findMany({
          take: 200,
          include: { tenant: { select: { name: true } } },
          orderBy: { period: "desc" },
        }),
        db.tryOnJob.groupBy({ by: ["status"], _count: true }),
        db.emailMessage.groupBy({ by: ["status"], _count: true }),
        db.platformAudit.findMany({
          take: 100,
          orderBy: { createdAt: "desc" },
        }),
      ]);
    res.json({
      stores,
      users,
      auditLogs,
      aiUsage,
      jobs,
      mail,
      platformAudit,
      features: featureNames,
      providers: {
        billing: billingConfigured(),
        photoTryOn: tryOnConfigured(),
        email: emailConfigured(),
        ar:
          process.env.AR_PROVIDER_APPROVED === "true" &&
          !!process.env.CAMERA_KIT_WEB_TOKEN,
      },
    });
  });
  router.patch("/platform/control/plans/:id", async (req, res) => {
    const input = planSchema
        .partial()
        .extend({
          features: z
            .array(z.enum(featureNames))
            .max(featureNames.length)
            .nullable()
            .optional(),
        })
        .strict()
        .parse(req.body),
      id = String(req.params.id);
    res.json(
      await db.$transaction(
        async (tx) => {
          const plan = requireFound(
            await tx.subscriptionPlan.findUnique({ where: { id } }),
          );
          const tenants = await tx.tenant.findMany({
            where: { planId: id },
            select: { id: true },
            orderBy: { id: "asc" },
          });
          for (const tenant of tenants) {
            await lockTenant(tx, tenant.id);
            const [products, stores, employees] = await Promise.all([
              tx.product.count({ where: { tenantId: tenant.id } }),
              tx.store.count({ where: { tenantId: tenant.id } }),
              tx.user.count({ where: { tenantId: tenant.id, active: true } }),
            ]);
            if (
              products > (input.productLimit ?? plan.productLimit) ||
              stores > (input.storeLimit ?? plan.storeLimit) ||
              employees > (input.employeeLimit ?? plan.employeeLimit)
            )
              throw new HttpError(
                409,
                "PLAN_USAGE",
                "One or more merchants exceed these limits. Resolve their usage before lowering the plan.",
              );
            await audit(
              tx,
              { ...res.locals.actor, tenantId: tenant.id },
              "PLAN_UPDATED",
              id,
              { fields: Object.keys(input) },
            );
          }
          const { features, ...fields } = input;
          await tx.platformAudit.create({
            data: {
              actorId: res.locals.actor.id,
              action: "PLAN_UPDATED",
              entityId: id,
              details: { fields: Object.keys(input) },
            },
          });
          return tx.subscriptionPlan.update({
            where: { id },
            data: {
              ...fields,
              ...(features !== undefined
                ? { features: features === null ? Prisma.DbNull : features }
                : {}),
            },
          });
        },
        { timeout: 20000 },
      ),
    );
  });
  router.post("/platform/control/users", async (req, res) => {
    const input = registerSchema
      .omit({ businessName: true })
      .strict()
      .parse(req.body);
    const passwordHash = await hashPassword(input.password);
    res.status(201).json(
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: input.name,
            email: input.email,
            passwordHash,
            role: "PLATFORM_ADMIN",
            tenantId: null,
          },
          select: { id: true, name: true, email: true, active: true },
        });
        await tx.platformAudit.create({
          data: {
            actorId: res.locals.actor.id,
            action: "OPERATOR_CREATED",
            entityId: user.id,
            details: {},
          },
        });
        return user;
      }),
    );
  });
  router.patch("/platform/control/users/:id", async (req, res) => {
    const { active } = z
        .object({ active: z.boolean() })
        .strict()
        .parse(req.body),
      id = String(req.params.id);
    if (id === res.locals.actor.id)
      throw new HttpError(
        409,
        "OPERATOR_SELF",
        "You cannot deactivate your own operator session.",
      );
    res.json(
      await db.$transaction(async (tx) => {
        const user = requireFound(
          await tx.user.findFirst({
            where: { id, role: "PLATFORM_ADMIN", tenantId: null },
          }),
        );
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.platformAudit.create({
          data: {
            actorId: res.locals.actor.id,
            action: "OPERATOR_STATUS_UPDATED",
            entityId: id,
            details: { active },
          },
        });
        return tx.user.update({
          where: { id: user.id },
          data: { active },
          select: { id: true, name: true, active: true },
        });
      }),
    );
  });
  return router;
}
