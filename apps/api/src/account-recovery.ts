import express from "express";
import { apiRateLimit } from "./rate-limits.js";
import { rateStore } from "./infrastructure.js";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { registerSchema } from "@innovia/validation";
import { db } from "./db.js";
import { hashPassword } from "./auth.js";
import { tokenHash } from "./customer-auth.js";
import { emailConfigured, queueEmail } from "./email.js";
import { HttpError, requireFound } from "./errors.js";
const requestSchema = registerSchema.pick({ email: true });
const resetSchema = registerSchema
  .pick({ password: true })
  .extend({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export function accountRecoveryRouter() {
  const root = express.Router();
  const limit = apiRateLimit({
    windowMs: 900000,
    limit: 10,
    ...rateStore("recovery"),
  });
  for (const kind of ["merchant", "customer"] as const) {
    const router = express.Router({ mergeParams: true });
    root.use(
      kind === "merchant"
        ? "/auth/recovery"
        : "/storefront/:slug/customer/recovery",
      router,
    );
    router.use(limit);
    router.post("/request", async (req, res) => {
      const { email } = requestSchema.parse(req.body);
      if (!emailConfigured())
        throw new HttpError(
          503,
          "MAIL_UNCONFIGURED",
          "Account recovery needs email delivery. Contact your boutique or platform support.",
        );
      const tenant =
        kind === "customer"
          ? requireFound(
              await db.tenant.findUnique({
                where: {
                  slug: String((req.params as Record<string, string>).slug),
                },
                select: { id: true, slug: true },
              }),
            )
          : null;
      const subject =
        kind === "merchant"
          ? await db.user.findUnique({ where: { email } })
          : await db.customer.findUnique({
              where: { tenantId_email: { tenantId: tenant!.id, email } },
            });
      if (subject && (!("active" in subject) || subject.active)) {
        const token = randomBytes(32).toString("hex"),
          expiresAt = new Date(Date.now() + 3600000);
        const base =
          kind === "merchant"
            ? process.env.ADMIN_ORIGIN
            : process.env.STOREFRONT_ORIGIN;
        if (!base)
          throw new HttpError(
            503,
            "MAIL_CONFIG",
            "Configure the public application origin.",
          );
        const url = new URL(
          kind === "merchant" ? "/" : `/${tenant!.slug}/account`,
          base,
        );
        url.searchParams.set("recovery", token);
        await db.$transaction(async (tx) => {
          const scope =
            kind === "merchant"
              ? { userId: subject.id }
              : { customerId: subject.id, tenantId: tenant!.id };
          await tx.recoveryToken.updateMany({
            where: { ...scope, usedAt: null },
            data: { usedAt: new Date() },
          });
          await tx.recoveryToken.create({
            data: { id: tokenHash(token), ...scope, email, expiresAt },
          });
          await queueEmail(
            tx,
            {
              to: email,
              subject: "Restore your INNOVIA account",
              text: `Use this private link within one hour to choose a new password: ${url.toString()}\nIf you did not request it, ignore this message.`,
            },
            expiresAt,
          );
        });
      }
      res.status(202).json({
        message:
          "If this email has an account, a private recovery link will be sent.",
      });
    });
    router.post("/reset", async (req, res) => {
      const input = resetSchema.parse(req.body),
        passwordHash = await hashPassword(input.password);
      const tenant =
        kind === "customer"
          ? requireFound(
              await db.tenant.findUnique({
                where: {
                  slug: String((req.params as Record<string, string>).slug),
                },
                select: { id: true },
              }),
            )
          : null;
      await db.$transaction(async (tx) => {
        const reset = await tx.recoveryToken.findFirst({
          where: {
            id: tokenHash(input.token),
            usedAt: null,
            expiresAt: { gt: new Date() },
            ...(kind === "merchant"
              ? { userId: { not: null } }
              : { tenantId: tenant!.id, customerId: { not: null } }),
          },
        });
        if (!reset)
          throw new HttpError(
            400,
            "RECOVERY_INVALID",
            "This link has expired or has already been used. Request a new link.",
          );
        const consumed = await tx.recoveryToken.updateMany({
          where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        if (!consumed.count)
          throw new HttpError(
            400,
            "RECOVERY_INVALID",
            "This link has already been used.",
          );
        if (kind === "merchant") {
          const changed = await tx.user.updateMany({
            where: { id: reset.userId!, email: reset.email, active: true },
            data: { passwordHash },
          });
          if (!changed.count)
            throw new HttpError(
              400,
              "RECOVERY_INVALID",
              "This account has changed. Request a new link.",
            );
          await tx.session.deleteMany({ where: { userId: reset.userId! } });
        } else {
          const changed = await tx.customer.updateMany({
            where: {
              id: reset.customerId!,
              tenantId: tenant!.id,
              email: reset.email,
            },
            data: { passwordHash },
          });
          if (!changed.count)
            throw new HttpError(
              400,
              "RECOVERY_INVALID",
              "This account has changed. Request a new link.",
            );
          await tx.customerSession.deleteMany({
            where: { tenantId: tenant!.id, customerId: reset.customerId! },
          });
        }
        await tx.recoveryToken.updateMany({
          where: {
            ...(kind === "merchant"
              ? { userId: reset.userId }
              : { tenantId: tenant!.id, customerId: reset.customerId }),
            usedAt: null,
          },
          data: { usedAt: new Date() },
        });
      });
      res.json({
        message: "Password changed. Sign in with your new password.",
      });
    });
  }
  return root;
}
