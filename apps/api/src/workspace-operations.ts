import express from "express";
import { apiRateLimit } from "./rate-limits.js";
import { rateStore } from "./infrastructure.js";
import { billingConfigured } from "./providers/billing.js";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "./db.js";
import {
  auth,
  tenantRequired,
  permit,
  hashPassword,
  safeUser,
  startSession,
  tenantSelect,
} from "./auth.js";
import { registerSchema } from "@innovia/validation";
import { tokenHash } from "./customer-auth.js";
import { audit, lockTenant, type Actor } from "./retail.js";
import { HttpError, requireFound } from "./errors.js";
const ticket = z.object({
  subject: z.string().min(3).max(150),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  body: z.string().min(3).max(5000),
});
export function workspaceOperationsRouter() {
  const router = express.Router(),
    owner = permit("OWNER"),
    manager = permit("OWNER", "MANAGER"),
    operator = permit("PLATFORM_ADMIN");
  router.post(
    "/auth/accept-invite",
    apiRateLimit({
      windowMs: 15 * 60000,
      limit: 20,
      ...rateStore("invitation-auth"),
    }),
    async (req, res) => {
      const input = registerSchema
          .omit({ businessName: true })
          .extend({ token: z.string().regex(/^[a-f0-9]{64}$/) })
          .parse(req.body),
        passwordHash = await hashPassword(input.password);
      const invite = requireFound(
        await db.staffInvite.findUnique({
          where: { tokenHash: tokenHash(input.token) },
        }),
      );
      const user = await db.$transaction(async (tx) => {
        await lockTenant(tx, invite.tenantId);
        const current = requireFound(
          await tx.staffInvite.findFirst({
            where: {
              id: invite.id,
              acceptedAt: null,
              cancelledAt: null,
              expiresAt: { gt: new Date() },
            },
          }),
        );
        if (current.email !== input.email)
          throw new HttpError(
            403,
            "INVITE_EMAIL",
            "Use the email address on this invitation.",
          );
        const tenant = await tx.tenant.findUniqueOrThrow({
          where: { id: current.tenantId },
          include: { plan: true },
        });
        if (
          (await tx.user.count({
            where: { tenantId: current.tenantId, active: true },
          })) >= tenant.plan.employeeLimit
        )
          throw new HttpError(
            403,
            "EMPLOYEE_LIMIT",
            "The plan’s employee limit has been reached.",
          );
        const created = await tx.user.create({
          data: {
            tenantId: current.tenantId,
            name: input.name,
            email: input.email,
            passwordHash,
            role: current.role,
          },
          include: { tenant: { select: tenantSelect } },
        });
        await tx.staffInvite.update({
          where: { id: current.id },
          data: { acceptedAt: new Date() },
        });
        await audit(
          tx,
          { tenantId: current.tenantId, id: created.id, role: created.role },
          "STAFF_INVITE_ACCEPTED",
          created.id,
          { role: created.role },
        );
        return created;
      });
      res.status(201).json({
        user: safeUser(user),
        tenant: user.tenant,
        csrfToken: await startSession(res, user.id),
      });
    },
  );
  router.use(["/staff", "/subscription", "/support"], auth, tenantRequired);
  router.get("/staff", manager, async (_req, res) => {
    const tenantId: string = res.locals.actor.tenantId;
    const [users, invites, tenant] = await Promise.all([
      db.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
        },
      }),
      db.staffInvite.findMany({
        where: {
          tenantId,
          acceptedAt: null,
          cancelledAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, email: true, role: true, expiresAt: true },
      }),
      db.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        include: { plan: true },
      }),
    ]);
    res.json({ users, invites, limit: tenant.plan.employeeLimit });
  });
  router.post("/staff/invites", owner, async (req, res) => {
    const input = z
        .object({
          email: z
            .string()
            .email()
            .max(254)
            .transform((email) => email.toLowerCase().trim()),
          role: z.enum(["MANAGER", "CASHIER"]),
        })
        .parse(req.body),
      actor: Actor = res.locals.actor,
      token = randomBytes(32).toString("hex");
    const invite = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      if (await tx.user.findUnique({ where: { email: input.email } }))
        throw new HttpError(
          409,
          "STAFF_EXISTS",
          "This email already belongs to a workspace account.",
        );
      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: actor.tenantId },
        include: { plan: true },
      });
      const users = await tx.user.count({
          where: { tenantId: actor.tenantId, active: true },
        }),
        invites = await tx.staffInvite.count({
          where: {
            tenantId: actor.tenantId,
            acceptedAt: null,
            cancelledAt: null,
            expiresAt: { gt: new Date() },
          },
        });
      if (users + invites >= tenant.plan.employeeLimit)
        throw new HttpError(
          403,
          "EMPLOYEE_LIMIT",
          "Active staff and pending invitations have reached the plan’s employee limit.",
        );
      if (
        await tx.staffInvite.count({
          where: {
            tenantId: actor.tenantId,
            email: input.email,
            acceptedAt: null,
            cancelledAt: null,
            expiresAt: { gt: new Date() },
          },
        })
      )
        throw new HttpError(
          409,
          "INVITE_EXISTS",
          "Cancel the existing invitation before creating another.",
        );
      const created = await tx.staffInvite.create({
        data: {
          ...input,
          tenantId: actor.tenantId,
          tokenHash: tokenHash(token),
          actorId: actor.id,
          expiresAt: new Date(Date.now() + 48 * 3600000),
        },
      });
      await audit(tx, actor, "STAFF_INVITED", created.id, { role: input.role });
      return created;
    });
    res.status(201).json({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      url: `${process.env.ADMIN_ORIGIN ?? "http://localhost:5174"}/?invite=${token}`,
    });
  });
  router.delete("/staff/invites/:id", owner, async (req, res) => {
    const actor: Actor = res.locals.actor;
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const invite = requireFound(
        await tx.staffInvite.findFirst({
          where: {
            id: String(req.params.id),
            tenantId: actor.tenantId,
            acceptedAt: null,
            cancelledAt: null,
          },
        }),
      );
      await tx.staffInvite.update({
        where: { id: invite.id },
        data: { cancelledAt: new Date() },
      });
      await audit(tx, actor, "STAFF_INVITE_CANCELLED", invite.id, {});
      return { ok: true };
    });
    res.json(result);
  });
  router.patch("/staff/:id", owner, async (req, res) => {
    const input = z
        .object({ active: z.boolean(), role: z.enum(["MANAGER", "CASHIER"]) })
        .strict()
        .parse(req.body),
      actor: Actor = res.locals.actor;
    const user = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const staff = requireFound(
        await tx.user.findFirst({
          where: { id: String(req.params.id), tenantId: actor.tenantId },
        }),
      );
      if (staff.id === actor.id || staff.role === "OWNER")
        throw new HttpError(
          403,
          "OWNER_PROTECTED",
          "The owner account cannot be changed through staff management.",
        );
      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: actor.tenantId },
        include: { plan: true },
      });
      if (
        !staff.active &&
        input.active &&
        (await tx.user.count({
          where: { tenantId: actor.tenantId, active: true },
        })) >= tenant.plan.employeeLimit
      )
        throw new HttpError(
          403,
          "EMPLOYEE_LIMIT",
          "The plan’s employee limit has been reached.",
        );
      const updated = await tx.user.update({
        where: { id: staff.id },
        data: input,
        select: { id: true, email: true, name: true, role: true, active: true },
      });
      await tx.session.deleteMany({ where: { userId: staff.id } });
      await audit(tx, actor, "STAFF_UPDATED", staff.id, input);
      return updated;
    });
    res.json(user);
  });
  router.get("/subscription", async (_req, res) => {
    const tenantId: string = res.locals.actor.tenantId;
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
        paidThrough: true,
        plan: true,
      },
    });
    const [products, stores, employees] = await Promise.all([
      db.product.count({ where: { tenantId } }),
      db.store.count({ where: { tenantId } }),
      db.user.count({ where: { tenantId, active: true } }),
    ]);
    res.json({
      ...tenant,
      usage: { products, stores, employees },
      provider: billingConfigured() ? "STRIPE" : "UNCONFIGURED",
    });
  });
  router.get("/support", async (_req, res) =>
    res.json(
      await db.supportTicket.findMany({
        where: { tenantId: res.locals.actor.tenantId },
        include: {
          messages: {
            where: { internal: false },
            orderBy: { createdAt: "asc" },
          },
        },
        take: 50,
        orderBy: { updatedAt: "desc" },
      }),
    ),
  );
  router.post("/support", async (req, res) => {
    const { body, ...data } = ticket.parse(req.body),
      actor: Actor = res.locals.actor;
    res.status(201).json(
      await db.$transaction(async (tx) => {
        const created = await tx.supportTicket.create({
          data: {
            ...data,
            tenantId: actor.tenantId,
            actorId: actor.id,
            messages: {
              create: {
                actorId: actor.id,
                authorName: res.locals.session.user.name,
                body,
              },
            },
          },
          include: { messages: true },
        });
        await audit(tx, actor, "SUPPORT_CREATED", created.id, {
          priority: data.priority,
        });
        return created;
      }),
    );
  });
  router.post("/support/:id/messages", async (req, res) => {
    const { body } = ticket.pick({ body: true }).parse(req.body),
      actor: Actor = res.locals.actor;
    res.status(201).json(
      await db.$transaction(async (tx) => {
        const current = requireFound(
          await tx.supportTicket.findFirst({
            where: { id: String(req.params.id), tenantId: actor.tenantId },
          }),
        );
        await tx.supportTicket.update({
          where: { id: current.id },
          data: { status: "OPEN", updatedAt: new Date() },
        });
        return tx.supportMessage.create({
          data: {
            tenantId: actor.tenantId,
            ticketId: current.id,
            actorId: actor.id,
            authorName: res.locals.session.user.name,
            body,
          },
        });
      }),
    );
  });
  router.use("/platform/workspaces", auth, operator);
  router.get("/platform/workspaces/support", async (_req, res) =>
    res.json(
      await db.supportTicket.findMany({
        include: {
          tenant: { select: { name: true } },
          messages: { orderBy: { createdAt: "asc" } },
        },
        take: 100,
        orderBy: { updatedAt: "desc" },
      }),
    ),
  );
  router.post("/platform/workspaces/support/:id/messages", async (req, res) => {
    const input = z
      .object({
        body: z.string().min(3).max(5000),
        internal: z.boolean().default(false),
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
      })
      .parse(req.body);
    res.status(201).json(
      await db.$transaction(async (tx) => {
        const current = requireFound(
          await tx.supportTicket.findUnique({
            where: { id: String(req.params.id) },
          }),
        );
        const actor = { ...res.locals.actor, tenantId: current.tenantId };
        await tx.supportTicket.update({
          where: { id: current.id },
          data: { status: input.status },
        });
        const result = await tx.supportMessage.create({
          data: {
            tenantId: current.tenantId,
            ticketId: current.id,
            actorId: actor.id,
            authorName: "INNOVIA Support",
            body: input.body,
            internal: input.internal,
          },
        });
        await audit(tx, actor, "SUPPORT_REPLIED", current.id, {
          internal: input.internal,
          status: input.status,
        });
        return result;
      }),
    );
  });
  router.patch("/platform/workspaces/:id/subscription", async (req, res) => {
    const input = z
        .object({
          subscriptionStatus: z.enum([
            "TRIAL",
            "ACTIVE",
            "PAST_DUE",
            "SUSPENDED",
          ]),
          trialEndsAt: z.string().datetime().nullable(),
        })
        .parse(req.body),
      id = String(req.params.id);
    if (input.subscriptionStatus === "TRIAL" && !input.trialEndsAt)
      throw new HttpError(422, "TRIAL_DATE", "Set an end date for a trial.");
    res.json(
      await db.$transaction(async (tx) => {
        await lockTenant(tx, id);
        const actor = { ...res.locals.actor, tenantId: id };
        const updated = await tx.tenant.update({
          where: { id },
          data: {
            ...input,
            trialEndsAt: input.trialEndsAt ? new Date(input.trialEndsAt) : null,
          },
          select: { id: true, subscriptionStatus: true, trialEndsAt: true },
        });
        await audit(tx, actor, "SUBSCRIPTION_UPDATED", id, input);
        return updated;
      }),
    );
  });
  return router;
}
