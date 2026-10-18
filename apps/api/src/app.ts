import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { type Store as RateLimitStore } from "express-rate-limit";
import { apiRateLimit } from "./rate-limits.js";
import { rateStore } from "./infrastructure.js";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z, ZodError } from "zod";
import pino from "pino";
import {
  loginSchema,
  registerSchema,
  productSchema,
  adjustmentSchema,
  checkoutSchema,
  brandingSchema,
  storeSchema,
  planSchema,
  variantSchema,
  cmsPageSchema,
} from "@innovia/validation";
import { db } from "./db.js";
import {
  auth,
  hashPassword,
  permit,
  safeUser,
  startSession,
  tenantRequired,
  tenantSelect,
  verifyPassword,
} from "./auth.js";
import { HttpError, requireFound } from "./errors.js";
import {
  adjustStock,
  checkout,
  createProduct,
  orderInclude,
  productInclude,
  transitionOrder,
} from "./retail.js";
import { analytics } from "./analytics.js";
import { accountRecoveryRouter } from "./account-recovery.js";
import { reportsRouter } from "./reports.js";
import { sizeAdvisorRouter } from "./size-advisor.js";
import { platformControlRouter } from "./platform-control.js";
import { arRouter } from "./ar.js";
import { pushRouter } from "./push.js";
import { mediaRouter, validateManagedMedia } from "./media.js";
import { workspaceOperationsRouter } from "./workspace-operations.js";
import { tryOnRouter } from "./try-on.js";
import { cashPromotionsRouter } from "./cash-promotions.js";
import { crmCampaignsRouter } from "./crm-campaigns.js";
import { billingRouter, billingWebhook } from "./billing.js";
import { lockTenant } from "./retail.js";
import { customerOperationsRouter } from "./customer-operations.js";
import { customerDirectorySelect } from "./customer-auth.js";
import { customerAccountsRouter } from "./customer-accounts.js";
import {
  contentCommerceRouter,
  commerceSelect,
  liveContent,
  verifyPreview,
} from "./content-commerce.js";
import {
  retailOperationsRouter,
  productEditSchema,
} from "./retail-operations.js";
export const logger = pino({
  level: process.env.NODE_ENV === "test" ? "silent" : "info",
  redact: ["password", "passwordHash", "cookie", "authorization"],
});
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  q: z.string().max(100).default(""),
  category: z.string().max(80).optional(),
  collection: z.string().max(80).optional(),
  brand: z.string().max(80).optional(),
  size: z.string().max(20).optional(),
  color: z.string().max(40).optional(),
  minPrice: z.coerce.number().min(0).max(99999999).optional(),
  maxPrice: z.coerce.number().min(0).max(99999999).optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  sort: z.enum(["newest", "name", "price_asc", "price_desc"]).default("newest"),
});
const ownerManager = permit("OWNER", "MANAGER");
function publicProduct(
  product: Prisma.ProductGetPayload<{ include: typeof productInclude }>,
) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    brand: product.brand,
    collection: product.collection,
    imageUrl: product.imageUrl,
    tryOnEnabled: product.tryOnEnabled,
    season: product.season,
    audience: product.audience,
    material: product.material,
    fit: product.fit,
    care: product.care,
    sizeChart: product.sizeChart,
    media: product.media.map((m) => ({
      url: m.url,
      alt: m.alt,
      kind: m.kind,
      position: m.position,
    })),
    variants: product.variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      price: v.price,
      availability: v.inventory
        .filter((i) => i.store.kind === "STORE")
        .map((i) => ({
          storeId: i.storeId,
          available: i.onHand - i.reserved,
        })),
    })),
  };
}
export function createApp(
  options: { globalRateLimitStore?: RateLimitStore } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 0));
  const origins = [
    process.env.ADMIN_ORIGIN ?? "http://localhost:5174",
    process.env.STOREFRONT_ORIGIN ?? "http://localhost:3000",
  ];
  app.use(helmet(), cors({ origin: origins, credentials: true }));
  app.post(
    "/api/v1/billing/stripe/webhook",
    apiRateLimit({ windowMs: 60000, limit: 120, ...rateStore("billing-webhook") }),
    express.raw({ type: "application/json", limit: "256kb" }),
    billingWebhook,
  );
  app.use(express.json({ limit: "128kb" }), cookieParser());
  app.use((req, _res, next) => {
    const origin = req.get("origin");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      origin &&
      !origins.includes(origin)
    )
      throw new HttpError(
        403,
        "ORIGIN_REJECTED",
        "This origin is not allowed.",
      );
    next();
  });
  app.use(
    apiRateLimit({
      windowMs: 60000,
      limit: 240,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      ...rateStore("global"),
      ...(options.globalRateLimitStore
        ? { store: options.globalRateLimitStore }
        : {}),
    }),
  );
  app.use((req, res, next) => {
    const requestId = randomUUID();
    res.setHeader("X-Request-ID", requestId);
    res.on("finish", () =>
      logger.info(
        {
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
        },
        "request",
      ),
    );
    res.on("finish", () => {
      if (
        process.env.NODE_ENV !== "test" &&
        [401, 403, 429].includes(res.statusCode)
      )
        void db.platformAudit
          .create({
            data: {
              actorId: res.locals.actor?.id ?? "anonymous",
              action: `ACCESS_${res.statusCode}`,
              entityId: requestId,
              details: { method: req.method, path: req.path },
            },
          })
          .catch(() => logger.warn("Security event persistence failed."));
    });
    next();
  });
  const authLimiter = apiRateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...rateStore("staff-auth"),
  });
  app.get("/api/v1/health", async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      database: "mysql",
      milestone: "connected-retail-commerce",
    });
  });
  app.get("/api/v1/openapi.json", (_req, res) =>
    res.sendFile(
      fileURLToPath(new URL("../../../docs/openapi.json", import.meta.url)),
    ),
  );
  app.post("/api/v1/auth/register", authLimiter, async (req, res) => {
    const input = registerSchema.parse(req.body);
    const passwordHash = await hashPassword(input.password);
    const plan = requireFound(
      await db.subscriptionPlan.findUnique({ where: { name: "Starter" } }),
      "Registration is unavailable until subscription plans are configured.",
    );
    const user = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.businessName,
          slug: `${input.businessName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 45)}-${randomUUID().slice(0, 6)}`,
          planId: plan.id,
          subscriptionStatus: "TRIAL",
          trialEndsAt: new Date(Date.now() + plan.trialDays * 86400000),
          stores: { create: { name: "Flagship", city: "Casablanca" } },
        },
      });
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          tenantId: tenant.id,
          role: "OWNER",
        },
        include: { tenant: { select: tenantSelect } },
      });
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorId: user.id,
          action: "MERCHANT_REGISTERED",
          entityId: tenant.id,
          details: { plan: plan.name },
        },
      });
      return user;
    });
    const csrfToken = await startSession(res, user.id);
    res
      .status(201)
      .json({
        user: safeUser(user),
        tenant: user.tenant,
        csrfToken,
        storefrontOrigin:
          process.env.STOREFRONT_ORIGIN ?? "http://localhost:3000",
      });
  });
  app.post("/api/v1/auth/login", authLimiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await db.user.findUnique({
      where: { email: input.email },
      include: { tenant: { select: tenantSelect } },
    });
    const dummy =
      "$2b$12$HuyUtLVYXn6xuKlIDiR0E.BlN75PwDQiSfZGZvAWphGbNxHLjiUym";
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? dummy,
    );
    if (!user || !user.active || !valid)
      throw new HttpError(
        401,
        "INVALID_CREDENTIALS",
        "The email or password is incorrect.",
      );
    const csrfToken = await startSession(res, user.id);
    res.json({
      user: safeUser(user),
      tenant: user.tenant,
      csrfToken,
      storefrontOrigin:
        process.env.STOREFRONT_ORIGIN ?? "http://localhost:3000",
    });
  });
  app.get("/api/v1/auth/me", auth, (_req, res) => {
    const session = res.locals.session;
    res.json({
      user: safeUser(session.user),
      tenant: session.user.tenant,
      csrfToken: session.csrfToken,
      storefrontOrigin:
        process.env.STOREFRONT_ORIGIN ?? "http://localhost:3000",
    });
  });
  app.post("/api/v1/auth/logout", auth, async (_req, res) => {
    await db.session.delete({ where: { id: res.locals.session.id } });
    res.clearCookie("innovia_session", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    res.json({ ok: true });
  });
  app.use("/api/v1", accountRecoveryRouter());
  app.use("/api/v1", reportsRouter());
  app.use("/api/v1", sizeAdvisorRouter());
  app.use("/api/v1", platformControlRouter());
  app.use("/api/v1", arRouter());
  app.use("/api/v1", pushRouter());
  app.use("/api/v1", workspaceOperationsRouter());
  app.use("/api/v1", retailOperationsRouter());
  app.use("/api/v1", customerOperationsRouter());
  app.use("/api/v1", mediaRouter());
  app.use("/api/v1", tryOnRouter());
  app.use("/api/v1", cashPromotionsRouter());
  app.use("/api/v1", crmCampaignsRouter());
  app.use("/api/v1", billingRouter());
  app.use("/api/v1", customerAccountsRouter());
  app.use("/api/v1", contentCommerceRouter());
  const retail = express.Router();
  retail.use(
    [
      "/products",
      "/categories",
      "/stores",
      "/inventory",
      "/analytics",
      "/orders",
      "/pos",
      "/customers",
      "/audit",
      "/settings",
    ],
    auth,
    tenantRequired,
  );
  retail.get("/categories", async (_req, res) => {
    const categories = await db.product.findMany({
      where: { tenantId: res.locals.actor.tenantId },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
    res.json(categories.map((x) => x.category));
  });
  retail.get("/products", async (req, res) => {
    const query = pagination.parse(req.query);
    const where: Prisma.ProductWhereInput = {
      tenantId: res.locals.actor.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { brand: { contains: query.q } },
              {
                variants: {
                  some: {
                    OR: [
                      { sku: { contains: query.q } },
                      { barcode: { contains: query.q } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        include: productInclude,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy:
          query.sort === "name" ? { name: "asc" } : { createdAt: "desc" },
      }),
      db.product.count({ where }),
    ]);
    res.json({ items, total, page: query.page, limit: query.limit });
  });
  retail.get("/products/:id", async (req, res) =>
    res.json(
      requireFound(
        await db.product.findFirst({
          where: {
            id: String(req.params.id),
            tenantId: res.locals.actor.tenantId,
          },
          include: productInclude,
        }),
      ),
    ),
  );
  retail.post("/products", ownerManager, async (req, res) =>
    res
      .status(201)
      .json(
        await createProduct(res.locals.actor, productSchema.parse(req.body)),
      ),
  );
  retail.patch("/products/:id", ownerManager, async (req, res) => {
    const data = productEditSchema.parse(req.body);
    const product = requireFound(
      await db.product.findFirst({
        where: {
          id: String(req.params.id),
          tenantId: res.locals.actor.tenantId,
        },
      }),
    );
    const updated = await db.$transaction(async (tx) => {
      await lockTenant(tx, product.tenantId);
      await validateManagedMedia(tx, product.tenantId, [
        data.imageUrl,
        data.tryOnImageUrl,
      ]);
      const result = await tx.product.update({
        where: { id: product.id },
        data,
        include: productInclude,
      });
      await tx.auditLog.create({
        data: {
          tenantId: product.tenantId,
          actorId: res.locals.actor.id,
          action: "PRODUCT_UPDATED",
          entityId: product.id,
          details: data,
        },
      });
      return result;
    });
    res.json(updated);
  });
  retail.post("/products/:id/variants", ownerManager, async (req, res) => {
    const input = variantSchema
      .extend({ storeId: z.string().min(1) })
      .parse(req.body);
    const tenantId = res.locals.actor.tenantId;
    const result = await db.$transaction(async (tx) => {
      const product = requireFound(
        await tx.product.findFirst({
          where: { tenantId, id: String(req.params.id) },
        }),
      );
      requireFound(
        await tx.store.findFirst({ where: { tenantId, id: input.storeId } }),
      );
      const { quantity, reorderPoint, storeId, ...data } = input;
      const variant = await tx.productVariant.create({
        data: {
          ...data,
          tenantId,
          productId: product.id,
          inventory: { create: { storeId, onHand: quantity, reorderPoint } },
        },
      });
      if (quantity)
        await tx.stockMovement.create({
          data: {
            tenantId,
            storeId,
            variantId: variant.id,
            quantity,
            reason: "Opening variant stock",
            type: "OPENING",
            actorId: res.locals.actor.id,
          },
        });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: res.locals.actor.id,
          action: "VARIANT_CREATED",
          entityId: variant.id,
          details: { sku: variant.sku },
        },
      });
      return variant;
    });
    res.status(201).json(result);
  });
  retail.get("/stores", async (_req, res) =>
    res.json(
      await db.store.findMany({
        where: { tenantId: res.locals.actor.tenantId },
        orderBy: { createdAt: "asc" },
      }),
    ),
  );
  retail.post("/stores", ownerManager, async (req, res) => {
    const input = storeSchema.parse(req.body);
    const actor = res.locals.actor;
    const store = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Tenant WHERE id = ${actor.tenantId} FOR UPDATE`;
      const tenant = requireFound(
        await tx.tenant.findUnique({
          where: { id: actor.tenantId },
          include: { plan: true },
        }),
      );
      if (
        (await tx.store.count({ where: { tenantId: actor.tenantId } })) >=
        tenant.plan.storeLimit
      )
        throw new HttpError(
          403,
          "PLAN_LIMIT",
          "Your plan’s store limit has been reached.",
        );
      return tx.store.create({ data: { ...input, tenantId: actor.tenantId } });
    });
    res.status(201).json(store);
  });
  retail.post("/inventory/adjustments", ownerManager, async (req, res) =>
    res.json(
      await adjustStock(
        res.locals.actor,
        adjustmentSchema.parse(req.body),
        req.get("Idempotency-Key"),
      ),
    ),
  );
  retail.get("/inventory/movements", async (req, res) => {
    const { page, limit } = pagination.parse(req.query);
    const where = { tenantId: res.locals.actor.tenantId };
    const [items, total] = await Promise.all([
      db.stockMovement.findMany({
        where,
        include: {
          variant: { include: { product: { select: { name: true } } } },
          store: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.stockMovement.count({ where }),
    ]);
    res.json({ items, total });
  });
  retail.get("/analytics", async (req, res) => {
    const days = z.coerce
      .number()
      .int()
      .min(1)
      .max(90)
      .default(30)
      .parse(req.query.days);
    const storeId = z.string().optional().parse(req.query.storeId);
    if (storeId)
      requireFound(
        await db.store.findFirst({
          where: { id: storeId, tenantId: res.locals.actor.tenantId },
        }),
      );
    res.json(await analytics(res.locals.actor.tenantId, days, storeId));
  });
  retail.get("/orders", async (req, res) => {
    const { page, limit } = pagination.parse(req.query);
    const where = { tenantId: res.locals.actor.tenantId };
    const [items, total] = await Promise.all([
      db.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.order.count({ where }),
    ]);
    res.json({ items, total });
  });
  retail.post(
    "/pos/checkout",
    permit("OWNER", "MANAGER", "CASHIER"),
    async (req, res) => {
      const input = checkoutSchema.parse(req.body);
      if (input.channel !== "POS")
        throw new HttpError(
          400,
          "INVALID_CHANNEL",
          "Use the storefront checkout for online orders.",
        );
      res
        .status(201)
        .json(
          await checkout(res.locals.actor, input, req.get("Idempotency-Key")),
        );
    },
  );
  retail.post("/orders/:id/:action", ownerManager, async (req, res) => {
    const action = z
      .enum(["complete", "cancel", "refund"])
      .parse(req.params.action);
    res.json(
      await transitionOrder(
        res.locals.actor,
        String(req.params.id),
        action,
        req.get("Idempotency-Key"),
      ),
    );
  });
  retail.get("/customers", async (req, res) => {
    const { page, limit, q } = pagination.parse(req.query);
    const where = {
      tenantId: res.locals.actor.tenantId,
      ...(q
        ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.customer.findMany({
        where,
        select: customerDirectorySelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.customer.count({ where }),
    ]);
    res.json({ items, total });
  });
  retail.get("/audit", async (_req, res) =>
    res.json(
      await db.auditLog.findMany({
        where: { tenantId: res.locals.actor.tenantId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ),
  );
  retail.patch("/settings", ownerManager, async (req, res) => {
    const data = brandingSchema.parse(req.body);
    const tenant = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Tenant WHERE id = ${res.locals.actor.tenantId} FOR UPDATE`;
      const current = requireFound(
        await tx.tenant.findUnique({
          where: { id: res.locals.actor.tenantId },
        }),
      );
      await validateManagedMedia(tx, current.id, [data.heroImage]);
      if (
        current.currency !== data.currency &&
        ((await tx.product.count({ where: { tenantId: current.id } })) > 0 ||
          (await tx.deliveryZone.count({ where: { tenantId: current.id } })) >
            0 ||
          (await tx.reward.count({ where: { tenantId: current.id } })) > 0 ||
          (await tx.order.count({ where: { tenantId: current.id } })) > 0 ||
          (await tx.cashSession.count({ where: { tenantId: current.id } })) >
            0 ||
          (await tx.coupon.count({ where: { tenantId: current.id } })) > 0)
      )
        throw new HttpError(
          409,
          "CURRENCY_LOCKED",
          "Currency cannot change while products, delivery fees, rewards or orders exist. Their amounts require a controlled currency conversion.",
        );
      const result = await tx.tenant.update({
        where: { id: current.id },
        data,
        select: tenantSelect,
      });
      await tx.auditLog.create({
        data: {
          tenantId: result.id,
          actorId: res.locals.actor.id,
          action: "BRANDING_UPDATED",
          entityId: result.id,
          details: {
            name: result.name,
            locale: result.locale,
            currency: result.currency,
          },
        },
      });
      return result;
    });
    res.json(tenant);
  });
  app.use("/api/v1", retail);
  const platform = express.Router();
  platform.use(auth, permit("PLATFORM_ADMIN"));
  platform.get("/overview", async (_req, res) => {
    const [tenants, plans] = await Promise.all([
      db.tenant.findMany({
        include: {
          plan: true,
          _count: { select: { products: true, stores: true, users: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.subscriptionPlan.findMany(),
    ]);
    res.json({ tenants, plans });
  });
  platform.post("/plans", async (req, res) =>
    res
      .status(201)
      .json(
        await db.subscriptionPlan.create({ data: planSchema.parse(req.body) }),
      ),
  );
  platform.patch("/tenants/:id/plan", async (req, res) => {
    const input = z.object({ planId: z.string().min(1) }).parse(req.body);
    const tenantId = String(req.params.id);
    const tenant = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Tenant WHERE id = ${tenantId} FOR UPDATE`;
      const tenant = requireFound(
        await tx.tenant.findUnique({
          where: { id: tenantId },
          include: { _count: { select: { products: true, stores: true } } },
        }),
      );
      const plan = requireFound(
        await tx.subscriptionPlan.findUnique({ where: { id: input.planId } }),
      );
      if (
        tenant._count.products > plan.productLimit ||
        tenant._count.stores > plan.storeLimit ||
        (await tx.user.count({ where: { tenantId, active: true } })) >
          plan.employeeLimit
      )
        throw new HttpError(
          409,
          "PLAN_LIMIT",
          "This tenant’s usage exceeds the selected plan.",
        );
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: res.locals.actor.id,
          action: "PLAN_CHANGED",
          entityId: tenantId,
          details: { planId: plan.id },
        },
      });
      return tx.tenant.update({
        where: { id: tenantId },
        data: { planId: plan.id },
        select: tenantSelect,
      });
    });
    res.json(tenant);
  });
  app.use("/api/v1/platform", platform);
  const storefront = express.Router();
  storefront.get("/", async (req, res) => {
    const { page, limit, q } = pagination.parse(req.query);
    const where: Prisma.TenantWhereInput = {
      name: { contains: q },
      OR: [
        {
          subscriptionStatus: "ACTIVE",
          OR: [{ paidThrough: null }, { paidThrough: { gt: new Date() } }],
        },
        { subscriptionStatus: "TRIAL", trialEndsAt: { gt: new Date() } },
      ],
    };
    const [items, total] = await Promise.all([
      db.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          heroImage: true,
          heroSubtitle: true,
          currency: true,
          locale: true,
          demo: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
      }),
      db.tenant.count({ where }),
    ]);
    res.json({ items, total });
  });
  storefront.get("/:slug", async (req, res) => {
    const tenant = requireFound(
      await db.tenant.findUnique({
        where: { slug: String(req.params.slug) },
        select: tenantSelect,
      }),
    );
    const stores = await db.store.findMany({
      where: { tenantId: tenant.id, kind: "STORE" },
      select: { id: true, name: true, city: true },
    });
    const categories = await db.product.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      distinct: ["category"],
      select: { category: true },
    });
    const settings = await db.tenant.findUnique({
      where: { id: tenant.id },
      select: commerceSelect,
    });
    const zones = await db.deliveryZone.findMany({
      where: { tenantId: tenant.id, active: true },
      select: { id: true, name: true, cities: true, fee: true },
    });
    const page = await db.cMSPage.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "home" } },
      include: { sections: { orderBy: { position: "asc" } } },
    });
    const preview =
      typeof req.query.preview === "string" &&
      verifyPreview(req.query.preview, tenant.id);
    const content =
      preview && page
        ? cmsPageSchema.parse({
            title: page.title,
            seoTitle: page.seoTitle,
            seoDescription: page.seoDescription,
            design: page.design,
            sections: page.sections.map((s) => ({
              ...s,
              startsAt: s.startsAt?.toISOString() ?? null,
              endsAt: s.endsAt?.toISOString() ?? null,
            })),
          })
        : liveContent(page?.published ?? null);
    res.json({
      tenant,
      stores,
      settings,
      zones,
      content,
      preview,
      categories: categories.map((x) => x.category),
    });
  });
  storefront.get("/:slug/products", async (req, res) => {
    const tenant = requireFound(
      await db.tenant.findUnique({
        where: { slug: String(req.params.slug) },
        select: { id: true },
      }),
    );
    const {
      page,
      limit,
      q,
      category,
      collection,
      brand,
      size,
      color,
      minPrice,
      maxPrice,
      sort,
    } = pagination.parse(req.query);
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
      throw new HttpError(
        422,
        "PRICE_RANGE",
        "The maximum price must be at least the minimum.",
      );
    const where: Prisma.ProductWhereInput = {
      tenantId: tenant.id,
      status: "ACTIVE" as const,
      ...(q ? { name: { contains: q } } : {}),
      ...(category ? { category } : {}),
      ...(collection ? { collection } : {}),
      ...(brand ? { brand } : {}),
      ...(size || color || minPrice !== undefined || maxPrice !== undefined
        ? {
            variants: {
              some: {
                ...(size ? { size } : {}),
                ...(color ? { color } : {}),
                ...(minPrice !== undefined || maxPrice !== undefined
                  ? {
                      price: {
                        ...(minPrice !== undefined ? { gte: minPrice } : {}),
                        ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
                      },
                    }
                  : {}),
              },
            },
          }
        : {}),
    };
    const ranked =
      sort === "price_asc" || sort === "price_desc"
        ? await db.productVariant.groupBy({
            by: ["productId"],
            where: { product: where },
            _min: { price: true },
            orderBy: [
              { _min: { price: sort === "price_asc" ? "asc" : "desc" } },
              { productId: "asc" },
            ],
            skip: (page - 1) * limit,
            take: limit,
          })
        : null;
    const [items, total] = await Promise.all([
      db.product.findMany({
        where: ranked
          ? { ...where, id: { in: ranked.map((row) => row.productId) } }
          : where,
        include: productInclude,
        skip: ranked ? 0 : (page - 1) * limit,
        take: limit,
        orderBy: sort === "name" ? { name: "asc" } : { createdAt: "desc" },
      }),
      db.product.count({ where }),
    ]);
    res.json({
      items: (ranked
        ? ranked.map((row) => items.find((item) => item.id === row.productId)!)
        : items
      ).map(publicProduct),
      total,
    });
  });
  storefront.get("/:slug/facets", async (req, res) => {
    const tenant = requireFound(
      await db.tenant.findUnique({
        where: { slug: String(req.params.slug) },
        select: { id: true },
      }),
    );
    const [products, variants] = await Promise.all([
      db.product.findMany({
        where: { tenantId: tenant.id, status: "ACTIVE" },
        select: { brand: true, collection: true, category: true },
      }),
      db.productVariant.findMany({
        where: { tenantId: tenant.id, product: { status: "ACTIVE" } },
        select: { size: true, color: true },
      }),
    ]);
    const values = (items: string[]) =>
      [...new Set(items.filter(Boolean))].sort();
    res.json({
      brands: values(products.map((p) => p.brand)),
      collections: values(products.map((p) => p.collection)),
      categories: values(products.map((p) => p.category)),
      sizes: values(variants.map((v) => v.size)),
      colors: values(variants.map((v) => v.color)),
    });
  });
  storefront.get("/:slug/products/:id", async (req, res) => {
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
        include: productInclude,
      }),
    );
    res.json(publicProduct(product));
  });
  storefront.post(
    "/:slug/checkout",
    apiRateLimit({ windowMs: 60000, limit: 10, ...rateStore("checkout") }),
    async (req, res) => {
      const tenant = requireFound(
        await db.tenant.findUnique({
          where: { slug: String(req.params.slug) },
        }),
      );
      const input = checkoutSchema.parse(req.body);
      if (input.channel !== "ONLINE")
        throw new HttpError(
          400,
          "INVALID_CHANNEL",
          "Use online checkout for this store.",
        );
      const order = await checkout(
        { id: `guest:${tenant.id}`, tenantId: tenant.id, role: "CASHIER" },
        input,
        req.get("Idempotency-Key"),
      );
      res.status(201).json({
        number: order.number,
        status: order.status,
        total: order.total,
        shippingTotal: order.shippingTotal,
        taxTotal: order.taxTotal,
        trackingToken: order.trackingToken,
      });
    },
  );
  app.use("/api/v1/storefront", storefront);
  app.use((_req, _res) => {
    throw new HttpError(404, "NOT_FOUND", "This endpoint does not exist.");
  });
  const errors: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err && typeof err === "object" && err.type === "entity.too.large") {
      res.status(413).json({
        error: {
          code: "REQUEST_TOO_LARGE",
          message: "This request exceeds the upload or JSON size limit.",
        },
      });
      return;
    }
    if (err instanceof ZodError) {
      res.status(422).json({
        error: {
          code: "VALIDATION",
          message: err.issues
            .map((x) => `${x.path.join(".")}: ${x.message}`)
            .join(" · "),
          details: err.flatten(),
        },
      });
      return;
    }
    if (err instanceof HttpError) {
      res
        .status(err.status)
        .json({ error: { code: err.code, message: err.message } });
      return;
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      res.status(409).json({
        error: {
          code: "DUPLICATE",
          message: "This email, SKU or plan name is already in use.",
        },
      });
      return;
    }
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({
        error: {
          code: "INVALID_JSON",
          message: "Send a valid JSON request.",
        },
      });
      return;
    }
    logger.error(
      { error: err instanceof Error ? err.message : "unknown" },
      "request failed",
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed. Please try again.",
      },
    });
  };
  app.use(errors);
  return app;
}
