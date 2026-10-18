import express from "express";
import { apiRateLimit } from "./rate-limits.js";
import { rateStore } from "./infrastructure.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  customerRegisterSchema,
  customerLoginSchema,
  addressSchema,
} from "@innovia/validation";
import { db } from "./db.js";
import { hashPassword, verifyPassword } from "./auth.js";
import {
  customerAuth,
  customerCookie,
  customerProfileSelect,
  customerOrderSelect,
  startCustomerSession,
} from "./customer-auth.js";
import { command, audit, lockTenant, type Actor } from "./retail.js";
import { expirePoints, redeemRewardInTransaction } from "./loyalty.js";
import { HttpError, requireFound } from "./errors.js";
import { deleteCustomerTryOn } from "./try-on.js";
import { liveTryOnProvider } from "./providers/try-on.js";
import { awardBirthday } from "./loyalty-bonuses.js";
import { validatePreferences } from "./crm-campaigns.js";
import { requireFeature } from "./features.js";

export function customerAccountsRouter() {
  const root = express.Router(),
    router = express.Router({ mergeParams: true });
  root.use("/storefront/:slug/customer", router);
  router.use(async (req, res, next) => {
    res.locals.boutique = requireFound(
      await db.tenant.findUnique({
        where: { slug: String(req.params.slug) },
        select: { id: true, name: true, slug: true },
      }),
    );
    next();
  });
  const limit = apiRateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    ...rateStore("customer-auth"),
  });
  router.post("/register", limit, async (req, res) => {
    const input = customerRegisterSchema.parse(req.body),
      tenantId: string = res.locals.boutique.id;
    const passwordHash = await hashPassword(input.password);
    const customer = await db.$transaction(async (tx) => {
      await lockTenant(tx, tenantId);
      if (
        await tx.customer.findUnique({
          where: { tenantId_email: { tenantId, email: input.email } },
        })
      )
        throw new HttpError(
          409,
          "CUSTOMER_EXISTS",
          "This email already has a boutique record. Sign in or contact the boutique to securely activate an existing guest record.",
        );
      const created = await tx.customer.create({
        data: {
          tenantId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          passwordHash,
        },
        select: customerProfileSelect,
      });
      await tx.customerConsent.create({
        data: {
          tenantId,
          customerId: created.id,
          purpose: "ACCOUNT_TERMS",
          granted: true,
          version: "1",
        },
      });
      await audit(
        tx,
        { tenantId, id: created.id, role: "CASHIER" },
        "CUSTOMER_REGISTERED",
        created.id,
        { termsVersion: "1" },
      );
      return created;
    });
    res.status(201).json({
      customer,
      ...(await startCustomerSession(
        res,
        tenantId,
        customer.id,
        input.client === "native",
      )),
    });
  });
  router.post("/login", limit, async (req, res) => {
    const input = customerLoginSchema.parse(req.body),
      tenantId: string = res.locals.boutique.id;
    const customer = await db.customer.findUnique({
      where: { tenantId_email: { tenantId, email: input.email } },
    });
    const dummy =
      "$2b$12$HuyUtLVYXn6xuKlIDiR0E.BlN75PwDQiSfZGZvAWphGbNxHLjiUym";
    const valid = await verifyPassword(
      input.password,
      customer?.passwordHash ?? dummy,
    );
    if (!customer?.passwordHash || !valid)
      throw new HttpError(
        401,
        "INVALID_CREDENTIALS",
        "The email or password is incorrect.",
      );
    res.json({
      customer: await db.customer.findUniqueOrThrow({
        where: { id: customer.id },
        select: customerProfileSelect,
      }),
      ...(await startCustomerSession(
        res,
        tenantId,
        customer.id,
        input.client === "native",
      )),
    });
  });
  router.use(customerAuth);
  router.use(async (req, res, next) => {
    if (
      /\/loyalty(?:\/|$)/.test(req.path) &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method)
    )
      await requireFeature(db, res.locals.boutique.id, "LOYALTY");
    next();
  });
  router.get("/me", (_req, res) =>
    res.json({
      customer: res.locals.customerSession.customer,
      csrfToken: res.locals.customerSession.csrfToken,
    }),
  );
  router.post("/logout", async (_req, res) => {
    await db.pushDevice.updateMany({
      where: {
        tenantId: res.locals.boutique.id,
        customerId: res.locals.customerSession.customerId,
      },
      data: { active: false },
    });
    await db.customerSession.delete({
      where: { id: res.locals.customerSession.id },
    });
    res.clearCookie(customerCookie(res.locals.boutique.id), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    res.json({ ok: true });
  });
  router.patch("/profile", async (req, res) => {
    const input = z
        .object({
          name: z.string().min(2).max(100),
          phone: z.string().regex(/^(\+212|0)[5-7]\d{8}$/),
          birthday: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable(),
        })
        .strict()
        .parse(req.body),
      actor: Actor = res.locals.customerActor;
    const birthday = input.birthday
      ? new Date(`${input.birthday}T00:00:00Z`)
      : null;
    if (
      birthday &&
      (Number.isNaN(birthday.getTime()) ||
        birthday > new Date() ||
        birthday.toISOString().slice(0, 10) !== input.birthday)
    )
      throw new HttpError(422, "BIRTHDAY", "Enter a valid birth date.");
    const customer = await db.$transaction(async (tx) => {
      const result = await tx.customer.update({
        where: { id: actor.id },
        data: { ...input, birthday },
        select: customerProfileSelect,
      });
      await audit(tx, actor, "CUSTOMER_PROFILE_UPDATED", actor.id, {
        changed: ["name", "phone", "birthday"],
      });
      return result;
    });
    res.json(customer);
  });
  router.get("/orders", async (req, res) => {
    const actor: Actor = res.locals.customerActor,
      page = z.coerce
        .number()
        .int()
        .min(1)
        .parse(req.query.page ?? 1),
      where = { tenantId: actor.tenantId, customerId: actor.id };
    const [items, total] = await Promise.all([
      db.order.findMany({
        where,
        select: customerOrderSelect,
        take: 24,
        skip: (page - 1) * 24,
        orderBy: { createdAt: "desc" },
      }),
      db.order.count({ where }),
    ]);
    res.json({ items, total });
  });
  router.put("/preferences", async (req, res) => {
    const actor: Actor = res.locals.customerActor;
    res.json(
      await db.$transaction(async (tx) => {
        await lockTenant(tx, actor.tenantId);
        const preferences = await validatePreferences(
          tx,
          actor.tenantId,
          req.body,
        );
        return tx.customer.update({
          where: { id: actor.id },
          data: { preferences },
          select: customerProfileSelect,
        });
      }),
    );
  });
  router.get("/addresses", async (_req, res) => {
    const actor: Actor = res.locals.customerActor;
    res.json(
      await db.customerAddress.findMany({
        where: { tenantId: actor.tenantId, customerId: actor.id },
      }),
    );
  });
  router.post("/addresses", async (req, res) => {
    const input = addressSchema.parse(req.body),
      actor: Actor = res.locals.customerActor;
    res.status(201).json(
      await db.$transaction(async (tx) => {
        await lockTenant(tx, actor.tenantId);
        if (
          (await tx.customerAddress.count({
            where: { tenantId: actor.tenantId, customerId: actor.id },
          })) >= 10
        )
          throw new HttpError(
            422,
            "ADDRESS_LIMIT",
            "Keep at most ten saved addresses.",
          );
        return tx.customerAddress.create({
          data: { ...input, tenantId: actor.tenantId, customerId: actor.id },
        });
      }),
    );
  });
  router.delete("/addresses/:id", async (req, res) => {
    const actor: Actor = res.locals.customerActor;
    const result = await db.customerAddress.deleteMany({
      where: {
        tenantId: actor.tenantId,
        customerId: actor.id,
        id: String(req.params.id),
      },
    });
    if (!result.count)
      throw new HttpError(404, "NOT_FOUND", "Address not found.");
    res.json({ ok: true });
  });
  router.get("/wishlist", async (_req, res) => {
    const actor: Actor = res.locals.customerActor;
    const items = await db.wishlistItem.findMany({
      where: {
        tenantId: actor.tenantId,
        customerId: actor.id,
        product: { status: "ACTIVE" },
      },
      include: {
        product: {
          select: { id: true, name: true, imageUrl: true, category: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(items);
  });
  router.post("/wishlist", async (req, res) => {
    const { productId } = z
        .object({ productId: z.string().min(1) })
        .parse(req.body),
      actor: Actor = res.locals.customerActor;
    res.status(201).json(
      await db.$transaction(async (tx) => {
        await lockTenant(tx, actor.tenantId);
        requireFound(
          await tx.product.findFirst({
            where: {
              tenantId: actor.tenantId,
              id: productId,
              status: "ACTIVE",
            },
          }),
        );
        if (
          (await tx.wishlistItem.count({
            where: { tenantId: actor.tenantId, customerId: actor.id },
          })) >= 100
        )
          throw new HttpError(
            422,
            "WISHLIST_LIMIT",
            "Your wishlist can hold 100 pieces.",
          );
        return tx.wishlistItem.upsert({
          where: {
            tenantId_customerId_productId: {
              tenantId: actor.tenantId,
              customerId: actor.id,
              productId,
            },
          },
          create: { tenantId: actor.tenantId, customerId: actor.id, productId },
          update: {},
        });
      }),
    );
  });
  router.delete("/wishlist/:id", async (req, res) => {
    const actor: Actor = res.locals.customerActor;
    await db.wishlistItem.deleteMany({
      where: {
        tenantId: actor.tenantId,
        customerId: actor.id,
        productId: String(req.params.id),
      },
    });
    res.json({ ok: true });
  });
  router.get("/consents", async (_req, res) => {
    const actor: Actor = res.locals.customerActor;
    res.json(
      await db.customerConsent.findMany({
        where: { tenantId: actor.tenantId, customerId: actor.id },
      }),
    );
  });
  router.put("/consents", async (req, res) => {
    const input = z
        .object({
          purpose: z.enum([
            "EMAIL_MARKETING",
            "IN_APP_MARKETING",
            "SMS_MARKETING",
            "PUSH_MARKETING",
          ]),
          granted: z.boolean(),
        })
        .parse(req.body),
      actor: Actor = res.locals.customerActor;
    res.json(
      await db.$transaction(async (tx) => {
        const result = await tx.customerConsent.upsert({
          where: {
            tenantId_customerId_purpose: {
              tenantId: actor.tenantId,
              customerId: actor.id,
              purpose: input.purpose,
            },
          },
          create: {
            tenantId: actor.tenantId,
            customerId: actor.id,
            ...input,
            version: "1",
          },
          update: { granted: input.granted, version: "1" },
        });
        await audit(tx, actor, "CUSTOMER_CONSENT_CHANGED", actor.id, input);
        return result;
      }),
    );
  });
  router.get("/loyalty", async (_req, res) => {
    const actor: Actor = res.locals.customerActor;
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const account = await tx.loyaltyAccount.findUnique({
        where: {
          tenantId_customerId: {
            tenantId: actor.tenantId,
            customerId: actor.id,
          },
        },
      });
      if (account) await expirePoints(tx, actor.tenantId, account.id);
      await awardBirthday(tx, actor);
      return {
        account: account
          ? await tx.loyaltyAccount.findUnique({
              where: { id: account.id },
              include: {
                entries: { take: 50, orderBy: { createdAt: "desc" } },
                redemptions: {
                  include: { reward: true },
                  take: 50,
                  orderBy: { createdAt: "desc" },
                },
              },
            })
          : null,
        currency: (
          await tx.tenant.findUniqueOrThrow({
            where: { id: actor.tenantId },
            select: { currency: true },
          })
        ).currency,
        program: await tx.loyaltyProgram.findUnique({
          where: { tenantId: actor.tenantId },
          include: { tiers: { orderBy: { threshold: "asc" } } },
        }),
        rewards: await tx.reward.findMany({
          where: { tenantId: actor.tenantId, active: true },
          orderBy: { pointsCost: "asc" },
        }),
      };
    });
    res.json(result);
  });
  router.post("/loyalty/enroll", async (req, res) => {
    const { referralCode } = z
      .object({
        consent: z.literal(true),
        referralCode: z.string().min(1).max(100).optional(),
      })
      .parse(req.body);
    const actor: Actor = res.locals.customerActor;
    const result = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      const program = await tx.loyaltyProgram.findUnique({
        where: { tenantId: actor.tenantId },
      });
      if (!program?.enabled)
        throw new HttpError(
          409,
          "LOYALTY_PAUSED",
          "The boutique’s membership program is currently paused.",
        );
      const referrer = referralCode
        ? requireFound(
            await tx.loyaltyAccount.findFirst({
              where: { tenantId: actor.tenantId, cardCode: referralCode },
            }),
            "This referral code is unavailable.",
          )
        : null;
      if (referrer?.customerId === actor.id)
        throw new HttpError(
          422,
          "SELF_REFERRAL",
          "Use another member’s referral code.",
        );
      if (
        referrer &&
        (await tx.loyaltyAccount.count({
          where: { tenantId: actor.tenantId, customerId: actor.id },
        }))
      )
        throw new HttpError(
          409,
          "MEMBER_EXISTS",
          "Referral codes are set when joining the members club.",
        );
      const account = await tx.loyaltyAccount.upsert({
        where: {
          tenantId_customerId: {
            tenantId: actor.tenantId,
            customerId: actor.id,
          },
        },
        create: {
          tenantId: actor.tenantId,
          customerId: actor.id,
          consentAt: new Date(),
          referrerAccountId: referrer?.id,
        },
        update: {},
      });
      await audit(tx, actor, "LOYALTY_ENROLLED", account.id, { consent: true });
      return account;
    });
    res.status(201).json(result);
  });
  router.post("/loyalty/redeem", async (req, res) => {
    const { rewardId } = z
        .object({ rewardId: z.string().min(1) })
        .parse(req.body),
      actor: Actor = res.locals.customerActor;
    const account = requireFound(
      await db.loyaltyAccount.findUnique({
        where: {
          tenantId_customerId: {
            tenantId: actor.tenantId,
            customerId: actor.id,
          },
        },
      }),
    );
    res.status(201).json(
      await command(
        actor,
        req.get("Idempotency-Key"),
        { type: "redeem", accountId: account.id, rewardId },
        (tx) =>
          redeemRewardInTransaction(tx, actor, {
            accountId: account.id,
            rewardId,
          }),
      ),
    );
  });
  router.get("/notifications", async (_req, res) => {
    const actor: Actor = res.locals.customerActor;
    res.json(
      await db.notification.findMany({
        where: {
          tenantId: actor.tenantId,
          customerId: actor.id,
          channel: "IN_APP",
        },
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
    );
  });
  router.patch("/notifications/:id", async (req, res) => {
    const actor: Actor = res.locals.customerActor;
    await db.notification.updateMany({
      where: {
        tenantId: actor.tenantId,
        customerId: actor.id,
        id: String(req.params.id),
      },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  });
  router.get("/export", async (_req, res) => {
    const actor: Actor = res.locals.customerActor;
    const [
      customer,
      addresses,
      consents,
      orders,
      loyalty,
      notifications,
      wishlist,
    ] = await Promise.all([
      db.customer.findUnique({
        where: { id: actor.id },
        select: customerProfileSelect,
      }),
      db.customerAddress.findMany({
        where: { tenantId: actor.tenantId, customerId: actor.id },
      }),
      db.customerConsent.findMany({
        where: { tenantId: actor.tenantId, customerId: actor.id },
      }),
      db.order.findMany({
        where: { tenantId: actor.tenantId, customerId: actor.id },
        select: customerOrderSelect,
      }),
      db.loyaltyAccount.findUnique({
        where: {
          tenantId_customerId: {
            tenantId: actor.tenantId,
            customerId: actor.id,
          },
        },
        include: { entries: true, redemptions: true },
      }),
      db.notification.findMany({
        where: { tenantId: actor.tenantId, customerId: actor.id },
      }),
      db.wishlistItem.findMany({
        where: { tenantId: actor.tenantId, customerId: actor.id },
      }),
    ]);
    res.json({
      generatedAt: new Date(),
      customer,
      addresses,
      consents,
      orders,
      loyalty,
      notifications,
      wishlist,
    });
  });
  router.delete("/account", async (req, res) => {
    const { password } = customerLoginSchema
        .pick({ password: true })
        .parse(req.body),
      actor: Actor = res.locals.customerActor;
    const customer = requireFound(
      await db.customer.findUnique({ where: { id: actor.id } }),
    );
    if (
      !customer.passwordHash ||
      !(await verifyPassword(password, customer.passwordHash))
    )
      throw new HttpError(
        403,
        "REAUTHENTICATE",
        "Enter your current password to delete your account.",
      );
    const providerJobs = await db.$transaction(async (tx) => {
      await lockTenant(tx, actor.tenantId);
      if (
        await tx.order.count({
          where: {
            tenantId: actor.tenantId,
            customerId: actor.id,
            status: { in: ["PENDING", "IN_FULFILMENT"] },
          },
        })
      )
        throw new HttpError(
          409,
          "ACTIVE_ORDER",
          "Complete or cancel your pending orders before deleting your account.",
        );
      const where = { tenantId: actor.tenantId, customerId: actor.id };
      await tx.customerSession.deleteMany({ where });
      await tx.recoveryToken.deleteMany({ where });
      await tx.pushDevice.deleteMany({ where });
      await tx.customerAddress.deleteMany({ where });
      await tx.customerConsent.deleteMany({ where });
      await tx.wishlistItem.deleteMany({ where });
      await tx.notification.deleteMany({ where });
      await tx.campaignDelivery.deleteMany({ where });
      await tx.mediaAsset.updateMany({
        where,
        data: { deletedAt: new Date() },
      });
      const providerJobs = await deleteCustomerTryOn(tx, actor);
      const account = await tx.loyaltyAccount.findUnique({
        where: {
          tenantId_customerId: {
            tenantId: actor.tenantId,
            customerId: actor.id,
          },
        },
      });
      if (account) {
        await tx.rewardRedemption.updateMany({
          where: {
            tenantId: actor.tenantId,
            accountId: account.id,
            status: "ISSUED",
          },
          data: { status: "CANCELLED" },
        });
        await tx.loyaltyAccount.update({
          where: { id: account.id },
          data: { points: 0 },
        });
      }
      await tx.order.updateMany({
        where,
        data: {
          customerName: "Deleted customer",
          shippingAddress: Prisma.DbNull,
        },
      });
      await tx.customer.update({
        where: { id: actor.id },
        data: {
          name: "Deleted customer",
          email: `deleted-${randomUUID()}@invalid.local`,
          phone: "",
          notes: "",
          passwordHash: null,
          birthday: null,
          preferences: Prisma.DbNull,
        },
      });
      await audit(tx, actor, "CUSTOMER_ACCOUNT_DELETED", actor.id, {
        financialRecordsRetained: true,
      });
      return providerJobs;
    });
    for (const id of providerJobs)
      await liveTryOnProvider()
        ?.cancel(id)
        .catch(() => {});
    res.clearCookie(customerCookie(actor.tenantId), { path: "/" });
    res.json({ ok: true, retained: "Anonymized financial and audit records" });
  });
  return root;
}
