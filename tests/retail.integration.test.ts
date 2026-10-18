import {
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
  describe,
  it,
  expect,
} from "vitest";
import { MemoryStore } from "express-rate-limit";
import dotenv from "dotenv";
import supertest from "supertest";
import { randomUUID } from "node:crypto";
dotenv.config({ quiet: true });
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test"))
  throw new Error(
    "Set TEST_DATABASE_URL to a dedicated database ending in _test. Tests never use the development database.",
  );
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = "test";
const { db } = await import("../apps/api/src/db.js");
const { createApp } = await import("../apps/api/src/app.js");
const { hashPassword } = await import("../apps/api/src/auth.js");
const { createProduct, checkout, adjustStock, transitionOrder } =
  await import("../apps/api/src/retail.js");
const { command } = await import("../apps/api/src/retail.js");
const { enqueueTryOn, runTryOnJobs } =
  await import("../apps/api/src/try-on.js");
const { saveImage } = await import("../apps/api/src/media.js");
const globalRateLimitStore = new MemoryStore();
const app = createApp({ globalRateLimitStore });
beforeEach(() => globalRateLimitStore.resetAll());
const key = () => randomUUID();
const suffix = key().slice(0, 8);
const tenantIds: string[] = [];
const planIds: string[] = [];
const userIds: string[] = [];
const emailIds: string[] = [];
let a: {
    id: string;
    storeId: string;
    userId: string;
    cookie: string;
    csrf: string;
  },
  b: typeof a,
  cashier: { cookie: string; csrf: string };
const product = (storeId: string, sku = key(), quantity = 5) => ({
  name: "Test linen shirt",
  description: "Test fixture",
  category: "Shirts",
  brand: "Fixture",
  collection: "Test",
  status: "ACTIVE" as const,
  imageUrl: "",
  storeId,
  variants: [
    {
      sku,
      size: "M",
      color: "Black",
      price: "10.25",
      cost: "4.10",
      quantity,
      reorderPoint: 2,
    },
  ],
});
beforeAll(async () => {
  const plan = await db.subscriptionPlan.create({
    data: {
      name: `Fixture-${suffix}`,
      monthlyPrice: "100.00",
      productLimit: 100,
      storeLimit: 2,
    },
  });
  planIds.push(plan.id);
  const starter = await db.subscriptionPlan.upsert({
    where: { name: "Starter" },
    update: {},
    create: {
      name: "Starter",
      monthlyPrice: "299.00",
      productLimit: 2,
      storeLimit: 1,
    },
  });
  const hash = await hashPassword("Fixture-password-123");
  async function fixture(name: string) {
    const tenant = await db.tenant.create({
      data: { name, slug: `${name}-${suffix}`, planId: plan.id },
    });
    tenantIds.push(tenant.id);
    const store = await db.store.create({
      data: { tenantId: tenant.id, name: "Flagship", city: "Casablanca" },
    });
    const user = await db.user.create({
      data: {
        tenantId: tenant.id,
        name,
        email: `${name}-${suffix}@example.test`,
        passwordHash: hash,
        role: "OWNER",
      },
    });
    userIds.push(user.id);
    const login = await supertest(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "Fixture-password-123" })
      .expect(200);
    return {
      id: tenant.id,
      storeId: store.id,
      userId: user.id,
      cookie: login.headers["set-cookie"][0].split(";")[0],
      csrf: login.body.csrfToken as string,
    };
  }
  a = await fixture("alpha");
  b = await fixture("beta");
  const cash = await db.user.create({
    data: {
      tenantId: a.id,
      name: "Cashier",
      email: `cashier-${suffix}@example.test`,
      passwordHash: hash,
      role: "CASHIER",
    },
  });
  userIds.push(cash.id);
  const login = await supertest(app)
    .post("/api/v1/auth/login")
    .send({ email: cash.email, password: "Fixture-password-123" })
    .expect(200);
  cashier = {
    cookie: login.headers["set-cookie"][0].split(";")[0],
    csrf: login.body.csrfToken,
  };
  expect(starter.productLimit).toBeGreaterThan(0);
});
afterAll(async () => {
  await db.emailMessage.deleteMany({ where: { id: { in: emailIds } } });
  await db.session.deleteMany({ where: { userId: { in: userIds } } });
  for (const id of tenantIds) {
    const where = { tenantId: id };
    await db.recurringBillingEvent.deleteMany({ where });
    await db.recurringBilling.deleteMany({ where });
    await db.billingEvent.deleteMany({ where });
    await db.subscriptionInvoice.deleteMany({ where });
    await db.staffInvite.deleteMany({ where });
    await db.supportMessage.deleteMany({ where });
    await db.supportTicket.deleteMany({ where });
    await db.customerSession.deleteMany({ where });
    await db.customerAddress.deleteMany({ where });
    await db.customerConsent.deleteMany({ where });
    await db.wishlistItem.deleteMany({ where });
    await db.notification.deleteMany({ where });
    await db.campaignDelivery.deleteMany({ where });
    await db.campaign.deleteMany({ where });
    await db.aICreditEntry.deleteMany({ where });
    await db.tryOnJob.deleteMany({ where });
    await db.aIUsage.deleteMany({ where });
    await db.cashMovement.deleteMany({ where });
    await db.cashSession.deleteMany({ where });
    await db.mediaAsset.updateMany({ where, data: { deletedAt: new Date() } });
    const { purgeMedia } = await import("../apps/api/src/media.js");
    await purgeMedia();
    await db.mediaAsset.deleteMany({ where });
    await db.cMSSection.deleteMany({ where });
    await db.cMSPage.deleteMany({ where });
    await db.rewardRedemption.deleteMany({ where });
    await db.loyaltyEntry.deleteMany({ where });
    await db.loyaltyAccount.updateMany({
      where,
      data: { referrerAccountId: null },
    });
    await db.loyaltyAccount.deleteMany({ where });
    await db.loyaltyTier.deleteMany({ where });
    await db.loyaltyProgram.deleteMany({ where });
    await db.reward.deleteMany({ where });
    await db.returnItem.deleteMany({ where });
    await db.returnRecord.deleteMany({ where });
    await db.stockTransfer.deleteMany({ where });
    await db.stockCount.deleteMany({ where });
    await db.purchaseOrderItem.deleteMany({ where });
    await db.purchaseOrder.deleteMany({ where });
    await db.supplier.deleteMany({ where });
    await db.productMedia.deleteMany({ where });
    await db.idempotentCommand.deleteMany({ where });
    await db.auditLog.deleteMany({ where });
    await db.orderItem.deleteMany({ where });
    await db.order.deleteMany({ where });
    await db.coupon.deleteMany({ where });
    await db.deliveryZone.deleteMany({ where });
    await db.stockMovement.deleteMany({ where });
    await db.inventory.deleteMany({ where });
    await db.productVariant.deleteMany({ where });
    await db.product.deleteMany({ where });
    await db.customer.deleteMany({ where });
    await db.user.deleteMany({ where });
    await db.store.deleteMany({ where });
    await db.tenant.delete({ where: { id } });
  }
  await db.subscriptionPlan.deleteMany({ where: { id: { in: planIds } } });
  await db.$disconnect();
});

describe("MySQL integration: retail operations", () => {
  const write = (path: string, body: unknown, requestKey = key()) =>
    supertest(app)
      .post(`/api/v1${path}`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .set("Idempotency-Key", requestKey)
      .send(body);
  it("duplicates drafts without cloning stock and updates bulk prices atomically within the tenant", async () => {
    const source = await createProduct(actor(), product(a.storeId)),
      foreign = await createProduct(
        { id: b.userId, tenantId: b.id, role: "OWNER" },
        product(b.storeId),
      );
    const copyKey = key(),
      input = {
        sourceId: source.id,
        storeId: a.storeId,
        name: "Duplicate linen shirt",
      };
    const copied = await write("/catalog/duplicate", input, copyKey).expect(
        201,
      ),
      repeated = await write("/catalog/duplicate", input, copyKey).expect(201);
    expect(copied.body.id).toBe(repeated.body.id);
    expect(copied.body.status).toBe("DRAFT");
    expect(copied.body.variants[0].sku).not.toBe(source.variants[0]!.sku);
    expect(copied.body.variants[0].inventory[0].onHand).toBe(0);
    await write("/catalog/duplicate", {
      ...input,
      sourceId: foreign.id,
    }).expect(404);
    const variantId = source.variants[0]!.id;
    await write("/catalog/prices", {
      items: [
        { variantId, price: "30.50" },
        { variantId: foreign.variants[0]!.id, price: "90.00" },
      ],
    }).expect(404);
    expect(
      (
        await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })
      ).price.toFixed(2),
    ).toBe("10.25");
    await write("/catalog/prices", {
      items: [
        { variantId, price: "30.50" },
        { variantId: copied.body.variants[0].id, price: "40.00" },
      ],
    }).expect(200);
    expect(
      (
        await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })
      ).price.toFixed(2),
    ).toBe("30.50");
  });
  it("uses correlated variant filters and stable backend price sorting with real facets", async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: a.id } });
    const brand = `Filter-${key()}`,
      low = await createProduct(actor(), {
        ...product(a.storeId),
        brand,
        name: "Cheaper filter fixture",
        variants: [
          {
            ...product(a.storeId).variants[0]!,
            sku: key(),
            size: "S",
            color: "Black",
            price: "11.00",
          },
          {
            ...product(a.storeId).variants[0]!,
            sku: key(),
            size: "L",
            color: "White",
            price: "30.00",
          },
        ],
      }),
      high = await createProduct(actor(), {
        ...product(a.storeId),
        brand,
        name: "Expensive filter fixture",
        variants: [
          {
            ...product(a.storeId).variants[0]!,
            sku: key(),
            size: "S",
            color: "Black",
            price: "22.00",
          },
        ],
      });
    const base = `/api/v1/storefront/${tenant.slug}`;
    const asc = await supertest(app)
      .get(`${base}/products`)
      .query({ brand, sort: "price_asc", limit: 1, page: 1 })
      .expect(200);
    expect(asc.body.items[0].id).toBe(low.id);
    const desc = await supertest(app)
      .get(`${base}/products`)
      .query({ brand, sort: "price_desc", limit: 1 })
      .expect(200);
    expect(desc.body.items[0].id).toBe(high.id);
    const impossible = await supertest(app)
      .get(`${base}/products`)
      .query({ brand, size: "S", color: "White" })
      .expect(200);
    expect(impossible.body.total).toBe(0);
    const facet = await supertest(app).get(`${base}/facets`).expect(200);
    expect(facet.body.brands).toContain(brand);
    await supertest(app)
      .get(`${base}/products`)
      .query({ minPrice: "99", maxPrice: "1" })
      .expect(422);
  });
  it("enforces feature entitlements in backend writes while allowing financial closure", async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: a.id } }),
      plan = await db.subscriptionPlan.findUniqueOrThrow({
        where: { id: tenant.planId },
      });
    const p = await createProduct(actor(), product(a.storeId));
    const order = await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: "Feature test",
        channel: "ONLINE",
        paymentMethod: "PICKUP",
        items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
      },
      key(),
    );
    await db.subscriptionPlan.update({
      where: { id: plan.id },
      data: { features: [] },
    });
    try {
      await supertest(app)
        .get("/api/v1/reports")
        .set("Cookie", a.cookie)
        .expect(403);
      await write("/campaigns", {
        title: "Blocked",
        body: "Blocked campaign",
      }).expect(403);
      await expect(
        checkout(
          actor(),
          {
            storeId: a.storeId,
            customerName: "Blocked commerce",
            channel: "ONLINE",
            paymentMethod: "PICKUP",
            items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
          },
          key(),
        ),
      ).rejects.toMatchObject({ code: "FEATURE_REQUIRED" });
      await write(`/orders/${order.id}/cancel`, {}).expect(200);
    } finally {
      const { Prisma } = await import("@prisma/client");
      await db.subscriptionPlan.update({
        where: { id: plan.id },
        data: { features: plan.features ?? Prisma.DbNull },
      });
    }
  });
  it("uses captured historical costs and excludes tax in merchandise margins", async () => {
    const { businessReport } = await import("../apps/api/src/reports.js");
    const p = await createProduct(actor(), {
      ...product(a.storeId),
      variants: [
        {
          ...product(a.storeId).variants[0]!,
          sku: key(),
          price: "120.00",
          cost: "40.00",
        },
      ],
    });
    await db.tenant.update({ where: { id: a.id }, data: { taxRate: "20.00" } });
    try {
      const sale = await checkout(
        actor(),
        {
          storeId: a.storeId,
          customerName: "Margin fixture",
          channel: "POS",
          paymentMethod: "CASH",
          items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
        },
        key(),
      );
      await db.productVariant.update({
        where: { id: p.variants[0]!.id },
        data: { cost: "99.00" },
      });
      const report = await businessReport(a.id, 30),
        row = report.dimensions.products!.find((item) => item.id === p.id)!;
      expect(row.revenue).toBe("100.00");
      expect(row.grossMargin).toBe("60.00");
      await db.orderItem.updateMany({
        where: { orderId: sale.id },
        data: { costCaptured: false },
      });
      expect(
        (await businessReport(a.id, 30)).dimensions.products!.find(
          (item) => item.id === p.id,
        )!.grossMargin,
      ).toBeNull();
      await db.orderItem.updateMany({
        where: { orderId: sale.id },
        data: { costCaptured: true },
      });
    } finally {
      await db.tenant.update({
        where: { id: a.id },
        data: { taxRate: "0.00" },
      });
    }
  });
  it("compares actual size charts, reports availability, and isolates AR and sizing products", async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: a.id } }),
      other = await db.tenant.findUniqueOrThrow({ where: { id: b.id } }),
      p = await createProduct(actor(), product(a.storeId));
    await db.product.update({
      where: { id: p.id },
      data: {
        sizeChart: [
          { size: "M", chest: 100, waist: 85 },
          { size: "L", chest: 110, waist: 95 },
        ],
      },
    });
    const path = `/api/v1/storefront/${tenant.slug}/products/${p.id}`;
    const result = await supertest(app)
      .post(`${path}/size-advisor`)
      .send({ chest: 101, waist: 85 })
      .expect(200);
    expect(result.body.recommendation.size).toBe("M");
    expect(result.body.recommendation.available).toBe(true);
    expect(result.body.alternative.size).toBe("L");
    await supertest(app).post(`${path}/size-advisor`).send({}).expect(422);
    await supertest(app)
      .post(`/api/v1/storefront/${other.slug}/products/${p.id}/size-advisor`)
      .send({ chest: 100 })
      .expect(404);
    const ar = await supertest(app).get(`${path}/ar`).expect(200);
    expect(ar.body.enabled).toBe(false);
    expect(ar.body.apiToken).toBeUndefined();
    await supertest(app)
      .get(`/api/v1/storefront/${other.slug}/products/${p.id}/ar`)
      .expect(404);
  });
  it("consumes private customer recovery once and revokes existing tenant-bound sessions", async () => {
    const { decryptMessage } = await import("../apps/api/src/email.js"),
      tenant = await db.tenant.findUniqueOrThrow({ where: { id: a.id } }),
      other = await db.tenant.findUniqueOrThrow({ where: { id: b.id } });
    const email = `recovery-${key()}@example.test`,
      base = `/api/v1/storefront/${tenant.slug}/customer`;
    const registered = await supertest(app)
      .post(`${base}/register`)
      .send({
        email,
        name: "Recovery fixture",
        phone: "+212612345678",
        password: "Recovery-password-123",
        termsAccepted: true,
        client: "native",
      })
      .expect(201);
    const existing = new Set(
      (await db.emailMessage.findMany({ select: { id: true } })).map(
        (item) => item.id,
      ),
    );
    const oldTransport = process.env.MAIL_TRANSPORT;
    process.env.MAIL_TRANSPORT = "local";
    try {
      const known = await supertest(app)
          .post(`${base}/recovery/request`)
          .send({ email })
          .expect(202),
        unknown = await supertest(app)
          .post(`${base}/recovery/request`)
          .send({ email: `missing-${key()}@example.test` })
          .expect(202);
      expect(known.body).toEqual(unknown.body);
      const message = (
        await db.emailMessage.findMany({ where: { status: "QUEUED" } })
      ).find((item) => !existing.has(item.id))!;
      emailIds.push(message.id);
      expect(message.payload).not.toContain(email);
      const text = decryptMessage(message.payload).text,
        token = new URL(text.match(/https?:\/\/\S+/)![0]).searchParams.get(
          "recovery",
        )!;
      const stored = await db.recoveryToken.findFirstOrThrow({
        where: { customerId: registered.body.customer.id },
      });
      expect(stored.id).not.toBe(token);
      await supertest(app)
        .post(`/api/v1/storefront/${other.slug}/customer/recovery/reset`)
        .send({ token, password: "New-recovery-password-123" })
        .expect(400);
      await supertest(app)
        .post(`${base}/recovery/reset`)
        .send({ token, password: "New-recovery-password-123" })
        .expect(200);
      await supertest(app)
        .get(`${base}/me`)
        .set("Authorization", `Bearer ${registered.body.token}`)
        .expect(401);
      await supertest(app)
        .post(`${base}/recovery/reset`)
        .send({ token, password: "Another-password-123" })
        .expect(400);
      await supertest(app)
        .post(`${base}/login`)
        .send({
          email,
          password: "New-recovery-password-123",
          client: "native",
        })
        .expect(200);
    } finally {
      if (oldTransport === undefined) delete process.env.MAIL_TRANSPORT;
      else process.env.MAIL_TRANSPORT = oldTransport;
    }
  });
  it("keeps design drafts private until publishing and preserves product-specific shoe equivalents", async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: a.id } });
    const draft = {
      title: "Test boutique",
      seoTitle: "",
      seoDescription: "",
      sections: [],
      design: {
        headingFont: "SANS",
        spacing: "COMPACT",
        footerText: "A fixture brand",
        navigation: [{ label: "Our edit", href: "#collection" }],
        socialLinks: [
          { label: "Instagram", href: "https://www.instagram.com/example/" },
        ],
      },
    };
    await supertest(app)
      .put("/api/v1/cms")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send(draft)
      .expect(200);
    const before = await supertest(app)
      .get(`/api/v1/storefront/${tenant.slug}`)
      .expect(200);
    expect(before.body.content?.design?.footerText).not.toBe("A fixture brand");
    const preview = await write("/cms/preview", {}).expect(200),
      token = new URL(preview.body.url).searchParams.get("preview")!;
    const privateView = await supertest(app)
      .get(`/api/v1/storefront/${tenant.slug}`)
      .query({ preview: token })
      .expect(200);
    expect(privateView.body.content.design.headingFont).toBe("SANS");
    await write("/cms/publish", {}).expect(200);
    const live = await supertest(app)
      .get(`/api/v1/storefront/${tenant.slug}`)
      .expect(200);
    expect(live.body.content.design.footerText).toBe("A fixture brand");
    await supertest(app)
      .put("/api/v1/cms")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({
        ...draft,
        design: {
          ...draft.design,
          navigation: [{ label: "Bad", href: "javascript:alert(1)" }],
        },
      })
      .expect(422);
    const p = await createProduct(actor(), product(a.storeId));
    await db.product.update({
      where: { id: p.id },
      data: {
        sizeChart: [
          { size: "M", footLength: 26, equivalentSizes: "Brand EU 41 / US 8" },
          { size: "L", footLength: 27 },
        ],
      },
    });
    const advice = await supertest(app)
      .post(`/api/v1/storefront/${tenant.slug}/products/${p.id}/size-advisor`)
      .send({ footLength: 26.2 })
      .expect(200);
    expect(advice.body.recommendation.size).toBe("M");
    expect(advice.body.recommendation.equivalentSizes).toBe(
      "Brand EU 41 / US 8",
    );
    expect(advice.body.basis).toContain("specific to this product");
    await db.cMSPage.deleteMany({ where: { tenantId: a.id } });
  });
  it("does not resend uncertain pushes, respects marketing consent and validates delivery receipts", async () => {
    const { runPush } = await import("../apps/api/src/push.js");
    const customer = await db.customer.create({
        data: {
          tenantId: a.id,
          name: "Push fixture",
          email: `push-${key()}@example.test`,
        },
      }),
      device = await db.pushDevice.create({
        data: {
          tenantId: a.id,
          customerId: customer.id,
          token: `ExpoPushToken[${key()}]`,
        },
      });
    const notice = await db.notification.create({
      data: {
        tenantId: a.id,
        customerId: customer.id,
        title: "Order update",
        body: "Ready for collection",
      },
    });
    let sends = 0;
    await runPush(async () => {
      sends++;
      throw new Error("Unknown delivery");
    });
    await runPush(async () => {
      sends++;
      return { status: "ok", id: "ticket" };
    });
    expect(sends).toBe(1);
    expect(
      (
        await db.pushDelivery.findUniqueOrThrow({
          where: {
            notificationId_deviceId: {
              notificationId: notice.id,
              deviceId: device.id,
            },
          },
        })
      ).status,
    ).toBe("UNCERTAIN");
    const campaign = await db.notification.create({
      data: {
        tenantId: a.id,
        customerId: customer.id,
        title: "Collection",
        body: "New arrival",
        kind: "MARKETING",
      },
    });
    await runPush(async () => {
      sends++;
      return { status: "ok", id: "ticket" };
    });
    expect(sends).toBe(1);
    await db.customerConsent.create({
      data: {
        tenantId: a.id,
        customerId: customer.id,
        purpose: "IN_APP_MARKETING",
        granted: true,
        version: "1",
      },
    });
    await runPush(async () => {
      sends++;
      return { status: "ok", id: "ticket" };
    });
    expect(sends).toBe(2);
    await db.pushDelivery.updateMany({
      where: { notificationId: campaign.id },
      data: { createdAt: new Date(Date.now() - 1000000) },
    });
    await runPush(async (_data, receipt) => {
      expect(receipt).toBe("ticket");
      return { status: "ok" };
    });
    expect(
      (
        await db.pushDelivery.findUniqueOrThrow({
          where: {
            notificationId_deviceId: {
              notificationId: campaign.id,
              deviceId: device.id,
            },
          },
        })
      ).status,
    ).toBe("PROVIDER_DELIVERED");
    await db.pushDevice.update({
      where: { id: device.id },
      data: { active: false },
    });
  });
  it("edits product metadata, prices and ordered gallery without leaking internal costs", async () => {
    const p = await createProduct(actor(), product(a.storeId));
    await supertest(app)
      .patch(`/api/v1/products/${p.id}`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({
        material: "Linen",
        care: "Cold wash",
        season: "Summer",
        sizeChart: [{ size: "M", chest: 100 }],
      })
      .expect(200);
    await supertest(app)
      .patch(`/api/v1/variants/${p.variants[0]!.id}`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({ price: "19.99", cost: "7.50", barcode: "EAN-123" })
      .expect(200);
    await supertest(app)
      .put(`/api/v1/products/${p.id}/media`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({
        items: [
          {
            url: "https://example.test/front.jpg",
            alt: "Front view",
            kind: "IMAGE",
          },
        ],
      })
      .expect(200);
    const publicResponse = await supertest(app)
      .get(`/api/v1/storefront/alpha-${suffix}/products?q=Test`)
      .expect(200);
    const item = publicResponse.body.items.find(
      (i: { id: string }) => i.id === p.id,
    );
    expect(item.material).toBe("Linen");
    expect(item.variants[0].price).toBe("19.99");
    expect(item.variants[0].cost).toBeUndefined();
    expect(item.media[0].alt).toBe("Front view");
    await supertest(app)
      .patch(`/api/v1/variants/${p.variants[0]!.id}`)
      .set("Cookie", b.cookie)
      .set("X-CSRF-Token", b.csrf)
      .send({ price: "1.00" })
      .expect(404);
  });
  it("transfers stock once, preserves reservations, and hides warehouse stock from checkout", async () => {
    const warehouse = await db.store.create({
      data: {
        tenantId: a.id,
        name: "Fixture warehouse",
        city: "Casablanca",
        kind: "WAREHOUSE",
      },
    });
    const p = await createProduct(actor(), product(a.storeId, key(), 5)),
      variantId = p.variants[0]!.id;
    await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: "Reserve Buyer",
        channel: "ONLINE",
        paymentMethod: "PICKUP",
        items: [{ variantId, quantity: 2 }],
      },
      key(),
    );
    const payload = {
        variantId,
        fromStoreId: a.storeId,
        toStoreId: warehouse.id,
        quantity: 3,
        reason: "Physical delivery",
      },
      requestKey = key();
    const first = await write(
      "/inventory/transfers",
      payload,
      requestKey,
    ).expect(201);
    const replay = await write(
      "/inventory/transfers",
      payload,
      requestKey,
    ).expect(201);
    expect(replay.body.id).toBe(first.body.id);
    await write("/inventory/transfers", payload).expect(409);
    const stock = await db.inventory.findMany({
      where: { tenantId: a.id, variantId },
      orderBy: { onHand: "asc" },
    });
    expect(stock.map((s) => s.onHand)).toEqual([2, 3]);
    expect(stock[0]!.reserved).toBe(2);
    const boutique = await supertest(app)
      .get(`/api/v1/storefront/alpha-${suffix}`)
      .expect(200);
    expect(
      boutique.body.stores.some((s: { id: string }) => s.id === warehouse.id),
    ).toBe(false);
    await checkout(
      actor(),
      {
        storeId: warehouse.id,
        customerName: "Warehouse Buyer",
        channel: "POS",
        paymentMethod: "CASH",
        items: [{ variantId, quantity: 1 }],
      },
      key(),
    ).then(
      () => {
        throw new Error("Warehouse checkout must fail");
      },
      (err) => expect(err.status).toBe(404),
    );
    await write("/inventory/transfers", {
      ...payload,
      toStoreId: b.storeId,
    }).expect(404);
  });
  it("records count discrepancies once and refuses a count below reserved units", async () => {
    const p = await createProduct(actor(), product(a.storeId, key(), 5)),
      variantId = p.variants[0]!.id;
    const payload = {
        variantId,
        storeId: a.storeId,
        counted: 8,
        reason: "Annual physical count",
      },
      requestKey = key();
    const first = await write("/inventory/counts", payload, requestKey).expect(
      201,
    );
    expect(first.body.difference).toBe(3);
    await write("/inventory/counts", payload, requestKey).expect(201);
    expect(
      await db.stockCount.count({ where: { tenantId: a.id, variantId } }),
    ).toBe(1);
    await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: "Reserve Buyer",
        channel: "ONLINE",
        paymentMethod: "PICKUP",
        items: [{ variantId, quantity: 2 }],
      },
      key(),
    );
    await write("/inventory/counts", { ...payload, counted: 1 }).expect(409);
  });
  it("receives purchases atomically and cannot receive the same purchase twice", async () => {
    const p = await createProduct(actor(), product(a.storeId, key(), 1)),
      variantId = p.variants[0]!.id;
    const supplier = await write("/suppliers", {
      name: "Fixture supplier",
    }).expect(201);
    const created = await write("/purchases", {
      supplierId: supplier.body.id,
      storeId: a.storeId,
      items: [{ variantId, quantity: 4, unitCost: "3.25" }],
    }).expect(201);
    expect(created.body.total).toBe("13");
    const requestKey = key();
    await write(`/purchases/${created.body.id}/receive`, {}, requestKey).expect(
      200,
    );
    await write(`/purchases/${created.body.id}/receive`, {}, requestKey).expect(
      200,
    );
    await write(`/purchases/${created.body.id}/receive`, {}).expect(409);
    expect(
      (
        await db.inventory.findFirstOrThrow({
          where: { tenantId: a.id, variantId },
        })
      ).onHand,
    ).toBe(5);
    await write("/purchases", {
      supplierId: supplier.body.id,
      storeId: b.storeId,
      items: [{ variantId, quantity: 1, unitCost: "3.25" }],
    }).expect(404);
  });
  it("previews CSV, atomically imports variants, and rejects existing SKUs", async () => {
    const sku = `CSV-${suffix}`,
      csv = `name,category,sku,size,color,price,cost,quantity\r\n"CSV, linen",Shirts,${sku}-M,M,Ivory,100.00,40.00,3\r\n"CSV, linen",Shirts,${sku}-L,L,Ivory,100.00,40.00,2`;
    const preview = await write("/catalog/import", {
      csv,
      storeId: a.storeId,
      preview: true,
    }).expect(200);
    expect(preview.body).toMatchObject({
      products: 1,
      variants: 2,
      imported: false,
      errors: [],
    });
    expect(
      await db.productVariant.count({
        where: { tenantId: a.id, sku: { startsWith: sku } },
      }),
    ).toBe(0);
    const applied = await write("/catalog/import", {
      csv,
      storeId: a.storeId,
      preview: false,
    }).expect(200);
    expect(applied.body.imported).toBe(true);
    const retry = await write("/catalog/import", {
      csv,
      storeId: a.storeId,
      preview: false,
    }).expect(200);
    expect(retry.body.imported).toBe(false);
    expect(retry.body.errors).toHaveLength(2);
    const invalid = await write("/catalog/import", {
      csv: csv.replace("100.00", "-1"),
      storeId: a.storeId,
      preview: false,
    }).expect(200);
    expect(invalid.body.imported).toBe(false);
  });
  it("rejects cashier writes to retail operations", async () => {
    await supertest(app)
      .post("/api/v1/suppliers")
      .set("Cookie", cashier.cookie)
      .set("X-CSRF-Token", cashier.csrf)
      .send({ name: "Forbidden supplier" })
      .expect(403);
  });
});
const actor = () => ({ id: a.userId, tenantId: a.id, role: "OWNER" as const });
describe("MySQL integration: returns, exchanges and loyalty", () => {
  const write = (path: string, body: unknown, requestKey = key()) =>
    supertest(app)
      .post(`/api/v1${path}`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .set("Idempotency-Key", requestKey)
      .send(body);
  async function program(spendUnit = "10.25", pointsPerUnit = 10) {
    await supertest(app)
      .put("/api/v1/loyalty/program")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({
        name: "Fixture Club",
        enabled: true,
        spendUnit,
        pointsPerUnit,
        expiryDays: 365,
        tiers: [],
      })
      .expect(200);
  }
  async function member() {
    const customer = await db.customer.create({
      data: {
        tenantId: a.id,
        name: "Loyalty Buyer",
        email: `member-${key()}@example.test`,
      },
    });
    const account = await write("/loyalty/enroll", {
      customerId: customer.id,
      consent: true,
    }).expect(201);
    return { customer, account: account.body as { id: string } };
  }
  it("awards points once and reconciles partial and full refunds using the original rules", async () => {
    await program();
    const { customer, account } = await member();
    const p = await createProduct(actor(), product(a.storeId, key(), 5));
    const variantId = p.variants[0]!.id;
    const payload = {
        storeId: a.storeId,
        customerName: customer.name,
        email: customer.email,
        channel: "POS" as const,
        paymentMethod: "CASH" as const,
        items: [{ variantId, quantity: 2 }],
      },
      requestKey = key();
    const sale = await checkout(actor(), payload, requestKey);
    await checkout(actor(), payload, requestKey);
    expect(
      (await db.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } }))
        .points,
    ).toBe(20);
    expect(
      await db.loyaltyEntry.count({
        where: { tenantId: a.id, orderId: sale.id, type: "EARN" },
      }),
    ).toBe(1);
    await program("1.00", 100);
    const returnKey = key(),
      returned = {
        orderId: sale.id,
        reason: "One item returned",
        items: [{ orderItemId: sale.items[0]!.id, quantity: 1, restock: true }],
        expectedCashDifference: "-10.25",
      };
    await write("/returns", returned, returnKey).expect(201);
    await write("/returns", returned, returnKey).expect(201);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: sale.id } })).status,
    ).toBe("PARTIALLY_REFUNDED");
    expect(
      (await db.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } }))
        .points,
    ).toBe(10);
    await transitionOrder(actor(), sale.id, "refund", key());
    expect(
      (await db.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } }))
        .points,
    ).toBe(0);
    expect(
      (
        await db.inventory.findFirstOrThrow({
          where: { tenantId: a.id, variantId },
        })
      ).onHand,
    ).toBe(5);
    expect(
      (
        await db.order.findUniqueOrThrow({ where: { id: sale.id } })
      ).refundedTotal.toString(),
    ).toBe("20.5");
    await write("/returns", returned).expect(409);
  });
  it("records the correct exchange cash difference and rolls back unavailable replacements", async () => {
    const p = await createProduct(actor(), product(a.storeId, key(), 3)),
      variantId = p.variants[0]!.id;
    const replacementInput = product(a.storeId, key(), 1);
    replacementInput.variants[0]!.price = "25.50";
    const replacement = await createProduct(actor(), replacementInput);
    const sale = await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: "Exchange Buyer",
        channel: "POS",
        paymentMethod: "CASH",
        items: [{ variantId, quantity: 1 }],
      },
      key(),
    );
    const body = {
      orderId: sale.id,
      reason: "Size exchange",
      items: [{ orderItemId: sale.items[0]!.id, quantity: 1, restock: true }],
      replacementItems: [
        { variantId: replacement.variants[0]!.id, quantity: 2 },
      ],
      expectedCashDifference: "40.75",
    };
    await write("/returns", body).expect(409);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: sale.id } })).status,
    ).toBe("COMPLETED");
    const result = await write("/returns", {
      ...body,
      replacementItems: [
        { variantId: replacement.variants[0]!.id, quantity: 1 },
      ],
      expectedCashDifference: "15.25",
    }).expect(201);
    expect(result.body.cashDifference).toBe("15.25");
    expect(result.body.replacementOrder.status).toBe("COMPLETED");
    expect(
      (
        await db.inventory.findFirstOrThrow({
          where: { tenantId: a.id, variantId },
        })
      ).onHand,
    ).toBe(3);
  });
  it("prevents concurrent over-redemption and double voucher use, and restores reward points on full return", async () => {
    await program();
    const { customer, account } = await member();
    await write("/loyalty/adjust", {
      accountId: account.id,
      points: 30,
      reason: "Fixture award",
    }).expect(200);
    const reward = await write("/rewards", {
      name: "Fixture reward",
      pointsCost: 20,
      discountValue: "2.50",
    }).expect(201);
    const attempts = await Promise.all([
      write("/loyalty/redeem", {
        accountId: account.id,
        rewardId: reward.body.id,
      }),
      write("/loyalty/redeem", {
        accountId: account.id,
        rewardId: reward.body.id,
      }),
    ]);
    expect(attempts.map((r) => r.status).sort()).toEqual([201, 409]);
    const voucher = attempts.find((r) => r.status === 201)!.body;
    const p = await createProduct(actor(), product(a.storeId, key(), 5)),
      variantId = p.variants[0]!.id;
    const input = {
      storeId: a.storeId,
      customerName: customer.name,
      email: customer.email,
      rewardCode: voucher.code,
      channel: "POS" as const,
      paymentMethod: "CASH" as const,
      items: [{ variantId, quantity: 1 }],
    };
    await expect(
      checkout(
        actor(),
        { ...input, email: `wrong-${key()}@example.test` },
        key(),
      ),
    ).rejects.toMatchObject({ status: 403 });
    const sale = await checkout(actor(), input, key());
    expect(sale.total.toString()).toBe("7.75");
    await expect(checkout(actor(), input, key())).rejects.toMatchObject({
      status: 404,
    });
    await transitionOrder(actor(), sale.id, "refund", key());
    expect(
      (await db.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } }))
        .points,
    ).toBe(30);
    expect(
      (
        await db.order.findUniqueOrThrow({ where: { id: sale.id } })
      ).refundedTotal.toString(),
    ).toBe("7.75");
  });
  it("expires unused earned points once and does not create debt by refunding expired points", async () => {
    await program();
    const { customer, account } = await member();
    const p = await createProduct(actor(), product(a.storeId, key(), 3));
    const sale = await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: customer.name,
        email: customer.email,
        channel: "POS",
        paymentMethod: "CASH",
        items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
      },
      key(),
    );
    await db.loyaltyEntry.updateMany({
      where: { tenantId: a.id, orderId: sale.id, type: "EARN" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await supertest(app)
      .get(`/api/v1/loyalty/accounts/${account.id}`)
      .set("Cookie", a.cookie)
      .expect(200);
    await supertest(app)
      .get(`/api/v1/loyalty/accounts/${account.id}`)
      .set("Cookie", a.cookie)
      .expect(200);
    expect(
      await db.loyaltyEntry.count({
        where: { tenantId: a.id, accountId: account.id, type: "EXPIRE" },
      }),
    ).toBe(1);
    await transitionOrder(actor(), sale.id, "refund", key());
    expect(
      (await db.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } }))
        .points,
    ).toBe(0);
  });
  it("preserves an explicit negative balance when spent purchase points are refunded", async () => {
    await program();
    const { customer, account } = await member();
    const p = await createProduct(actor(), product(a.storeId, key(), 3));
    const sale = await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: customer.name,
        email: customer.email,
        channel: "POS",
        paymentMethod: "CASH",
        items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
      },
      key(),
    );
    const reward = await write("/rewards", {
      name: "Spent fixture",
      pointsCost: 10,
      discountValue: "1.00",
    }).expect(201);
    await write("/loyalty/redeem", {
      accountId: account.id,
      rewardId: reward.body.id,
    }).expect(201);
    await transitionOrder(actor(), sale.id, "refund", key());
    expect(
      (await db.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } }))
        .points,
    ).toBe(-10);
  });
  it("requires enrollment consent and rejects cross-tenant memberships", async () => {
    const customer = await db.customer.create({
      data: {
        tenantId: b.id,
        name: "Private Customer",
        email: `private-${key()}@example.test`,
      },
    });
    await write("/loyalty/enroll", {
      customerId: customer.id,
      consent: true,
    }).expect(404);
    await write("/loyalty/enroll", {
      customerId: customer.id,
      consent: false,
    }).expect(422);
  });
});
describe("MySQL integration: auth, permissions and isolation", () => {
  it("revokes the session on logout", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { id: a.userId } });
    const login = await supertest(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "Fixture-password-123" })
      .expect(200);
    const cookie = login.headers["set-cookie"][0].split(";")[0];
    await supertest(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", login.body.csrfToken)
      .send({})
      .expect(200);
    await supertest(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookie)
      .expect(401);
  });
  it("rejects unauthenticated catalog requests", async () => {
    await supertest(app).get("/api/v1/products").expect(401);
  });
  it("stores hashed passwords and issues HttpOnly cookies", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { id: a.userId } });
    expect(user.passwordHash.startsWith("$2")).toBe(true);
    const login = await supertest(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "Fixture-password-123" })
      .expect(200);
    expect(login.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(login.body.user.passwordHash).toBeUndefined();
  });
  it("requires CSRF for authenticated writes", async () => {
    await supertest(app)
      .post("/api/v1/products")
      .set("Cookie", a.cookie)
      .send(product(a.storeId))
      .expect(403);
  });
  it("rejects an untrusted browser origin", async () => {
    await supertest(app)
      .post("/api/v1/auth/login")
      .set("Origin", "https://untrusted.example")
      .send({ email: "x@example.test", password: "test" })
      .expect(403);
  });
  it("cashiers cannot create products or access the operator API", async () => {
    await supertest(app)
      .post("/api/v1/products")
      .set("Cookie", cashier.cookie)
      .set("X-CSRF-Token", cashier.csrf)
      .send(product(a.storeId))
      .expect(403);
    await supertest(app)
      .get("/api/v1/platform/overview")
      .set("Cookie", a.cookie)
      .expect(403);
  });
  it("creates a product and variant through the API", async () => {
    const response = await supertest(app)
      .post("/api/v1/products")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send(product(a.storeId))
      .expect(201);
    expect(response.body.variants[0].inventory[0].onHand).toBe(5);
    const count = await db.stockMovement.count({
      where: {
        tenantId: a.id,
        variantId: response.body.variants[0].id,
        type: "OPENING",
      },
    });
    expect(count).toBe(1);
  });
  it("cannot read or adjust another tenant’s product", async () => {
    const p = await createProduct(actor(), product(a.storeId));
    await supertest(app)
      .get(`/api/v1/products/${p.id}`)
      .set("Cookie", b.cookie)
      .expect(404);
    await supertest(app)
      .post("/api/v1/inventory/adjustments")
      .set("Cookie", b.cookie)
      .set("X-CSRF-Token", b.csrf)
      .set("Idempotency-Key", key())
      .send({
        variantId: p.variants[0]!.id,
        storeId: b.storeId,
        quantity: 1,
        reason: "Cross tenant attempt",
      })
      .expect(404);
  });
  it("rejects cross-tenant locations during creation", async () => {
    await supertest(app)
      .post("/api/v1/products")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send(product(b.storeId))
      .expect(404);
  });
  it("allows guest catalog filters without exposing cost or internal stock fields", async () => {
    const response = await supertest(app)
      .get(`/api/v1/storefront/alpha-${suffix}/products?category=Shirts`)
      .expect(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items[0].variants[0].cost).toBeUndefined();
    expect(response.body.items[0].variants[0].inventory).toBeUndefined();
  });
  it("registers a merchant, assigns the default plan and creates an isolated store", async () => {
    const response = await supertest(app)
      .post("/api/v1/auth/register")
      .send({
        name: "New Owner",
        businessName: "New boutique",
        email: `new-${suffix}@example.test`,
        password: "New-password-123",
      })
      .expect(201);
    tenantIds.push(response.body.tenant.id);
    userIds.push(response.body.user.id);
    expect(response.body.user.role).toBe("OWNER");
    expect(
      await db.store.count({ where: { tenantId: response.body.tenant.id } }),
    ).toBe(1);
    expect(response.body.tenant.plan.name).toBe("Starter");
  });
});
describe("MySQL integration: transactions and order state machine", () => {
  it("replays stock adjustments without double counting and rejects key reuse", async () => {
    const p = await createProduct(actor(), product(a.storeId));
    const variantId = p.variants[0]!.id;
    const commandKey = key();
    const data = {
      variantId,
      storeId: a.storeId,
      quantity: 3,
      reason: "Supplier delivery",
    };
    await adjustStock(actor(), data, commandKey);
    await adjustStock(actor(), data, commandKey);
    expect(
      (await db.inventory.findFirstOrThrow({ where: { variantId } })).onHand,
    ).toBe(8);
    await expect(
      adjustStock(actor(), { ...data, quantity: 2 }, commandKey),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("does not oversell during concurrent cash sales", async () => {
    const p = await createProduct(actor(), product(a.storeId, key(), 1));
    const input = {
      storeId: a.storeId,
      customerName: "Customer",
      channel: "POS" as const,
      paymentMethod: "CASH" as const,
      items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
    };
    const results = await Promise.allSettled([
      checkout(actor(), input, key()),
      checkout(actor(), input, key()),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((x) => x.status === "rejected")).toHaveLength(1);
    const stock = await db.inventory.findFirstOrThrow({
      where: { variantId: p.variants[0]!.id },
    });
    expect(stock.onHand).toBe(0);
    expect(
      await db.orderItem.count({ where: { variantId: p.variants[0]!.id } }),
    ).toBe(1);
  });
  it("reserves an online order once and releases it on cancellation", async () => {
    const p = await createProduct(actor(), product(a.storeId));
    const variantId = p.variants[0]!.id;
    const input = {
      storeId: a.storeId,
      customerName: "Guest Customer",
      channel: "ONLINE" as const,
      paymentMethod: "PICKUP" as const,
      items: [{ variantId, quantity: 2 }],
    };
    const commandKey = key();
    const order = await checkout(actor(), input, commandKey);
    const replay = await checkout(actor(), input, commandKey);
    expect(order.number).toBe(replay.number);
    let stock = await db.inventory.findFirstOrThrow({ where: { variantId } });
    expect([stock.onHand, stock.reserved]).toEqual([5, 2]);
    const cancelKey = key();
    await transitionOrder(actor(), order.id, "cancel", cancelKey);
    await transitionOrder(actor(), order.id, "cancel", cancelKey);
    stock = await db.inventory.findFirstOrThrow({ where: { variantId } });
    expect([stock.onHand, stock.reserved]).toEqual([5, 0]);
    await expect(
      transitionOrder(actor(), order.id, "complete", key()),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("fulfills a reservation and safely records one full reversal", async () => {
    const p = await createProduct(actor(), product(a.storeId));
    const variantId = p.variants[0]!.id;
    const order = await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: "Customer",
        channel: "ONLINE",
        paymentMethod: "PICKUP",
        items: [{ variantId, quantity: 2 }],
      },
      key(),
    );
    await transitionOrder(actor(), order.id, "complete", key());
    let stock = await db.inventory.findFirstOrThrow({ where: { variantId } });
    expect([stock.onHand, stock.reserved]).toEqual([3, 0]);
    const refundKey = key();
    await transitionOrder(actor(), order.id, "refund", refundKey);
    await transitionOrder(actor(), order.id, "refund", refundKey);
    stock = await db.inventory.findFirstOrThrow({ where: { variantId } });
    expect([stock.onHand, stock.reserved]).toEqual([5, 0]);
  });
  it("rolls back the entire sale when a later line has no stock", async () => {
    const p = await createProduct(actor(), product(a.storeId, key(), 2));
    const empty = await createProduct(actor(), product(a.storeId, key(), 0));
    await expect(
      checkout(
        actor(),
        {
          storeId: a.storeId,
          customerName: "Customer",
          channel: "POS",
          paymentMethod: "CASH",
          items: [
            { variantId: p.variants[0]!.id, quantity: 1 },
            { variantId: empty.variants[0]!.id, quantity: 1 },
          ],
        },
        key(),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await db.inventory.findFirstOrThrow({
          where: { variantId: p.variants[0]!.id },
        })
      ).onHand,
    ).toBe(2);
  });
  it("does not reduce on-hand stock below existing reservations", async () => {
    const p = await createProduct(actor(), product(a.storeId));
    const variantId = p.variants[0]!.id;
    await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: "Customer",
        channel: "ONLINE",
        paymentMethod: "PICKUP",
        items: [{ variantId, quantity: 4 }],
      },
      key(),
    );
    await expect(
      adjustStock(
        actor(),
        {
          variantId,
          storeId: a.storeId,
          quantity: -2,
          reason: "Invalid adjustment",
        },
        key(),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("enforces product plan limits on the backend", async () => {
    const existingProducts = await db.product.count({
      where: { tenantId: b.id },
    });
    const plan = await db.subscriptionPlan.create({
      data: {
        name: `Limited-${suffix}`,
        monthlyPrice: "1.00",
        productLimit: existingProducts + 1,
        storeLimit: 1,
      },
    });
    planIds.push(plan.id);
    await db.tenant.update({ where: { id: b.id }, data: { planId: plan.id } });
    const other = { id: b.userId, tenantId: b.id, role: "OWNER" as const };
    await createProduct(other, product(b.storeId));
    await expect(
      createProduct(other, product(b.storeId)),
    ).rejects.toMatchObject({ status: 403, code: "PLAN_LIMIT" });
  });
  it("guest checkout resolves tenant and prices on the server", async () => {
    const p = await createProduct(actor(), product(a.storeId));
    const response = await supertest(app)
      .post(`/api/v1/storefront/alpha-${suffix}/checkout`)
      .set("Idempotency-Key", key())
      .send({
        tenantId: b.id,
        total: "0.01",
        storeId: a.storeId,
        customerName: "Guest Customer",
        email: `guest-${suffix}@example.test`,
        channel: "ONLINE",
        paymentMethod: "PICKUP",
        items: [{ variantId: p.variants[0]!.id, quantity: 2 }],
      })
      .expect(201);
    expect(response.body.total).toBe("20.5");
    expect(response.body.status).toBe("PENDING");
  });
});

describe("MySQL integration: customer accounts, content and delivery", () => {
  const customerPath = () => `/api/v1/storefront/alpha-${suffix}/customer`;
  it("validates image files, strips metadata and protects referenced media", async () => {
    const { default: sharp } = await import("sharp");
    const image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#aabbcc" },
    })
      .withMetadata()
      .png()
      .toBuffer();
    const upload = await supertest(app)
      .post("/api/v1/media")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .set("Content-Type", "image/png")
      .send(image)
      .expect(201);
    const file = await supertest(app).get(upload.body.url).expect(200);
    expect(file.headers["content-type"]).toContain("image/webp");
    const metadata = await sharp(file.body).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    await supertest(app)
      .post("/api/v1/media")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .set("Content-Type", "image/png")
      .send(Buffer.from("<svg><script>alert(1)</script></svg>"))
      .expect(422);
    await supertest(app)
      .post("/api/v1/media")
      .set("Cookie", cashier.cookie)
      .set("X-CSRF-Token", cashier.csrf)
      .set("Content-Type", "image/png")
      .send(image)
      .expect(403);
    const otherProduct = await db.product.findFirstOrThrow({
      where: { tenantId: b.id },
    });
    await supertest(app)
      .patch(`/api/v1/products/${otherProduct.id}`)
      .set("Cookie", b.cookie)
      .set("X-CSRF-Token", b.csrf)
      .send({ imageUrl: upload.body.url })
      .expect(422);
    const p = await createProduct(
      actor(),
      { ...product(a.storeId), imageUrl: upload.body.url },
      key(),
    );
    await supertest(app)
      .delete(`/api/v1/media/${upload.body.id}`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .expect(409);
    await db.product.update({ where: { id: p.id }, data: { imageUrl: "" } });
    await supertest(app)
      .delete(`/api/v1/media/${upload.body.id}`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .expect(200);
    await supertest(app).get(upload.body.url).expect(404);
  });
  const merchant = (
    path: string,
    body: unknown,
    method: "post" | "put" = "post",
    requestKey = key(),
  ) => {
    const agent = supertest(app);
    return agent[method](`/api/v1${path}`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .set("Idempotency-Key", requestKey)
      .send(body);
  };
  async function registerCustomer(client = "web") {
    const email = `account-${key()}@example.test`;
    const response = await supertest(app)
      .post(`${customerPath()}/register`)
      .send({
        name: "Private Customer",
        email,
        phone: "+212612345678",
        password: "Customer-password-123",
        termsAccepted: true,
        client,
      })
      .expect(201);
    return {
      email,
      id: response.body.customer.id as string,
      cookie: response.headers["set-cookie"]?.[0]?.split(";")[0] as string,
      csrf: response.body.csrfToken as string,
      token: response.body.token as string,
    };
  }
  it("keeps customer photos private, requires consent and purges expired files", async () => {
    const { default: sharp } = await import("sharp"),
      { purgeMedia } = await import("../apps/api/src/media.js");
    const image = await sharp({
        create: { width: 64, height: 64, channels: 3, background: "#aabbcc" },
      })
        .png()
        .toBuffer(),
      customer = await registerCustomer(),
      other = await registerCustomer();
    const upload = () =>
      supertest(app)
        .post(`${customerPath()}/media`)
        .set("Cookie", customer.cookie)
        .set("X-CSRF-Token", customer.csrf)
        .set("Content-Type", "image/png");
    await upload().send(image).expect(422);
    const asset = await upload()
      .set("X-Photo-Consent", "self-photo-v1")
      .send(image)
      .expect(201);
    expect(asset.body.visibility).toBe("PRIVATE");
    expect(asset.body.url).toBeUndefined();
    await supertest(app).get(`/api/v1/media/${asset.body.id}`).expect(404);
    await supertest(app)
      .get(`${customerPath()}/media/${asset.body.id}`)
      .set("Cookie", other.cookie)
      .expect(404);
    const privateImage = await supertest(app)
      .get(`${customerPath()}/media/${asset.body.id}`)
      .set("Cookie", customer.cookie)
      .expect(200);
    expect(privateImage.headers["cache-control"]).toBe("no-store");
    await db.mediaAsset.update({
      where: { id: asset.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await purgeMedia();
    await supertest(app)
      .get(`${customerPath()}/media/${asset.body.id}`)
      .set("Cookie", customer.cookie)
      .expect(404);
    expect(
      (await db.mediaAsset.findUniqueOrThrow({ where: { id: asset.body.id } }))
        .bytes,
    ).toBe(0);
  });
  it("separates merchant and customer sessions and rejects cross-boutique credentials", async () => {
    const customer = await registerCustomer();
    const me = await supertest(app)
      .get(`${customerPath()}/me`)
      .set("Cookie", customer.cookie)
      .expect(200);
    expect(me.body.customer.email).toBe(customer.email);
    expect(me.body.customer.passwordHash).toBeUndefined();
    await supertest(app)
      .get(`/api/v1/storefront/beta-${suffix}/customer/me`)
      .set("Cookie", customer.cookie)
      .expect(401);
    await supertest(app)
      .get("/api/v1/products")
      .set("Cookie", customer.cookie)
      .expect(401);
    await supertest(app)
      .get(`${customerPath()}/me`)
      .set("Cookie", a.cookie)
      .expect(401);
    const directory = await supertest(app)
      .get(`/api/v1/customers?q=${encodeURIComponent(customer.email)}`)
      .set("Cookie", a.cookie)
      .expect(200);
    expect(directory.text).not.toContain("passwordHash");
  });
  it("requires customer CSRF and records marketing choices independently", async () => {
    const customer = await registerCustomer();
    await supertest(app)
      .put(`${customerPath()}/consents`)
      .set("Cookie", customer.cookie)
      .send({ purpose: "EMAIL_MARKETING", granted: true })
      .expect(403);
    await supertest(app)
      .put(`${customerPath()}/consents`)
      .set("Cookie", customer.cookie)
      .set("X-CSRF-Token", customer.csrf)
      .send({ purpose: "EMAIL_MARKETING", granted: true })
      .expect(200);
    const consents = await supertest(app)
      .get(`${customerPath()}/consents`)
      .set("Cookie", customer.cookie)
      .expect(200);
    expect(consents.body).toHaveLength(2);
    expect(
      await db.loyaltyAccount.count({ where: { customerId: customer.id } }),
    ).toBe(0);
  });
  it("does not let registration claim an existing guest history", async () => {
    const email = `existing-${key()}@example.test`;
    await db.customer.create({
      data: { tenantId: a.id, email, name: "Original guest" },
    });
    await supertest(app)
      .post(`${customerPath()}/register`)
      .send({
        name: "Imposter",
        email,
        phone: "+212612345678",
        password: "Customer-password-123",
        termsAccepted: true,
      })
      .expect(409);
    expect(
      (
        await db.customer.findUniqueOrThrow({
          where: { tenantId_email: { tenantId: a.id, email } },
        })
      ).passwordHash,
    ).toBeNull();
  });
  it("supports native bearer sessions with no ambient cookie and revokes them on logout", async () => {
    const customer = await registerCustomer("native");
    expect(customer.cookie).toBeUndefined();
    expect(customer.token).toMatch(/^[a-f0-9]{64}$/);
    await supertest(app)
      .patch(`${customerPath()}/profile`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        name: "Native Customer",
        phone: "+212612345678",
        birthday: "1990-01-01",
      })
      .expect(200);
    await supertest(app)
      .get(`/api/v1/storefront/beta-${suffix}/customer/me`)
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(401);
    await supertest(app)
      .post(`${customerPath()}/logout`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({})
      .expect(200);
    await supertest(app)
      .get(`${customerPath()}/me`)
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(401);
  });
  it("scopes saved addresses, wishlists and exports to the signed-in customer", async () => {
    const customer = await registerCustomer(),
      other = await registerCustomer();
    const address = await supertest(app)
      .post(`${customerPath()}/addresses`)
      .set("Cookie", customer.cookie)
      .set("X-CSRF-Token", customer.csrf)
      .send({
        label: "Home",
        recipient: "Private Customer",
        street: "123 Test Street",
        city: "Casablanca",
        postalCode: "20000",
        phone: "+212612345678",
        country: "MA",
      })
      .expect(201);
    await supertest(app)
      .delete(`${customerPath()}/addresses/${address.body.id}`)
      .set("Cookie", other.cookie)
      .set("X-CSRF-Token", other.csrf)
      .expect(404);
    const p = await createProduct(actor(), product(a.storeId));
    await supertest(app)
      .post(`${customerPath()}/wishlist`)
      .set("Cookie", customer.cookie)
      .set("X-CSRF-Token", customer.csrf)
      .send({ productId: p.id })
      .expect(201);
    expect(
      (
        await supertest(app)
          .get(`${customerPath()}/wishlist`)
          .set("Cookie", other.cookie)
          .expect(200)
      ).body,
    ).toHaveLength(0);
    const data = await supertest(app)
      .get(`${customerPath()}/export`)
      .set("Cookie", customer.cookie)
      .expect(200);
    expect(data.body.addresses[0].id).toBe(address.body.id);
    expect(data.text).not.toContain("passwordHash");
    expect(data.text).not.toContain(other.email);
    const foreign = await db.product.findFirstOrThrow({
      where: { tenantId: b.id },
    });
    await supertest(app)
      .post(`${customerPath()}/wishlist`)
      .set("Cookie", customer.cookie)
      .set("X-CSRF-Token", customer.csrf)
      .send({ productId: foreign.id })
      .expect(404);
  });
  it("preserves published CMS content while saving drafts, and binds previews to a tenant", async () => {
    const section = {
      kind: "HERO",
      title: "Published hero",
      body: "Considered pieces",
      imageUrl: "https://example.test/image.jpg",
      ctaLabel: "Discover",
      ctaHref: "#collection",
      collection: "",
      active: true,
      startsAt: null,
      endsAt: null,
    };
    const page = {
      title: "Fixture homepage",
      seoTitle: "Fixture SEO",
      seoDescription: "Fixture description",
      sections: [
        section,
        {
          ...section,
          kind: "PROMO",
          title: "Future campaign",
          startsAt: "2099-01-01T00:00:00.000Z",
        },
        { ...section, kind: "PROMO", active: false },
      ],
    };
    await merchant("/cms", page, "put").expect(200);
    expect(
      (
        await supertest(app)
          .get(`/api/v1/storefront/alpha-${suffix}`)
          .expect(200)
      ).body.content,
    ).toBeNull();
    await merchant("/cms/publish", {}).expect(200);
    await merchant(
      "/cms",
      { ...page, sections: [{ ...section, title: "Private draft" }] },
      "put",
    ).expect(200);
    const live = await supertest(app)
      .get(`/api/v1/storefront/alpha-${suffix}`)
      .expect(200);
    expect(live.body.content.sections).toHaveLength(1);
    expect(live.body.content.sections[0].title).toBe("Published hero");
    const preview = await merchant("/cms/preview", {}).expect(200),
      token = new URL(preview.body.url).searchParams.get("preview")!;
    const draft = await supertest(app)
      .get(`/api/v1/storefront/alpha-${suffix}`)
      .query({ preview: token })
      .expect(200);
    expect(draft.body.preview).toBe(true);
    expect(draft.body.content.sections[0].title).toBe("Private draft");
    expect(
      (
        await supertest(app)
          .get(`/api/v1/storefront/beta-${suffix}`)
          .query({ preview: token })
          .expect(200)
      ).body.preview,
    ).toBe(false);
    expect(
      (
        await supertest(app)
          .get(`/api/v1/storefront/alpha-${suffix}`)
          .query({ preview: `${token}tampered` })
          .expect(200)
      ).body.content.sections[0].title,
    ).toBe("Published hero");
    await merchant(
      "/cms",
      { ...page, sections: [{ ...section, ctaHref: "javascript:alert(1)" }] },
      "put",
    ).expect(422);
  });
  it("supports real collection filtering and hides unpublished product detail", async () => {
    const p = await createProduct(actor(), {
      ...product(a.storeId),
      collection: `capsule-${suffix}`,
    });
    const listing = await supertest(app)
      .get(`/api/v1/storefront/alpha-${suffix}/products`)
      .query({ collection: `capsule-${suffix}` })
      .expect(200);
    expect(listing.body.items.map((item: { id: string }) => item.id)).toEqual([
      p.id,
    ]);
    const detail = await supertest(app)
      .get(`/api/v1/storefront/alpha-${suffix}/products/${p.id}`)
      .expect(200);
    expect(detail.text).not.toContain('"cost"');
    await db.product.update({ where: { id: p.id }, data: { status: "DRAFT" } });
    await supertest(app)
      .get(`/api/v1/storefront/alpha-${suffix}/products/${p.id}`)
      .expect(404);
    await supertest(app)
      .get(`/api/v1/storefront/beta-${suffix}/products/${p.id}`)
      .expect(404);
  });
  async function deliveryOrder(email?: string) {
    const p = await createProduct(actor(), product(a.storeId, key(), 5));
    const zone = await merchant("/commerce/zones", {
      name: "Casablanca",
      cities: ["Casablanca"],
      fee: "5.50",
    }).expect(201);
    const input = {
      storeId: a.storeId,
      customerName: "Delivery Customer",
      email,
      phone: "+212612345678",
      channel: "ONLINE" as const,
      paymentMethod: "CASH_ON_DELIVERY" as const,
      deliveryZoneId: zone.body.id,
      shippingAddress: {
        recipient: "Delivery Customer",
        street: "123 Test Street",
        city: "Casablanca",
        postalCode: "20000",
        phone: "+212612345678",
        country: "MA" as const,
      },
      items: [{ variantId: p.variants[0]!.id, quantity: 2 }],
    };
    return { p, zone, input, order: await checkout(actor(), input, key()) };
  }
  it("adds server delivery fees and inclusive tax, validates zone and dispatches stock once", async () => {
    await db.tenant.update({ where: { id: a.id }, data: { taxRate: "20.00" } });
    const { p, input, order } = await deliveryOrder();
    expect(order.total.toString()).toBe("26");
    expect(order.taxTotal.toString()).toBe("4.33");
    await expect(
      checkout(
        actor(),
        {
          ...input,
          shippingAddress: { ...input.shippingAddress, city: "Rabat" },
        },
        key(),
      ),
    ).rejects.toMatchObject({ status: 422, code: "DELIVERY_CITY" });
    const requestKey = key();
    await merchant(
      `/orders/${order.id}/delivery`,
      {
        status: "SHIPPED",
        carrier: "Fixture carrier",
        trackingNumber: "ABC123",
      },
      "post",
      requestKey,
    ).expect(200);
    await merchant(
      `/orders/${order.id}/delivery`,
      {
        status: "SHIPPED",
        carrier: "Fixture carrier",
        trackingNumber: "ABC123",
      },
      "post",
      requestKey,
    ).expect(200);
    await transitionOrder(actor(), order.id, "complete", key());
    const stock = await db.inventory.findFirstOrThrow({
      where: { variantId: p.variants[0]!.id, storeId: a.storeId },
    });
    expect(stock.onHand).toBe(3);
    expect(stock.reserved).toBe(0);
    await merchant(`/orders/${order.id}/delivery`, {
      status: "RETURNED",
    }).expect(409);
    await db.tenant.update({ where: { id: a.id }, data: { taxRate: "0.00" } });
  });
  it("restocks failed delivery once and exposes only minimal tracking with its secret", async () => {
    const { p, order } = await deliveryOrder();
    await supertest(app)
      .get(`/api/v1/storefront/alpha-${suffix}/tracking`)
      .query({
        number: order.number,
        token: key().replaceAll("-", "").repeat(2),
      })
      .expect(404);
    const tracking = await supertest(app)
      .get(`/api/v1/storefront/alpha-${suffix}/tracking`)
      .query({ number: order.number, token: order.trackingToken })
      .expect(200);
    expect(tracking.text).not.toContain("shippingAddress");
    expect(tracking.text).not.toContain("trackingTokenHash");
    await merchant(`/orders/${order.id}/delivery`, {
      status: "SHIPPED",
      carrier: "Fixture",
    }).expect(200);
    await merchant(`/orders/${order.id}/delivery`, {
      status: "RETURNED",
    }).expect(200);
    await merchant(`/orders/${order.id}/delivery`, {
      status: "RETURNED",
    }).expect(409);
    expect(
      (
        await db.inventory.findFirstOrThrow({
          where: { variantId: p.variants[0]!.id },
        })
      ).onHand,
    ).toBe(5);
  });
  it("automatically expires reservations and releases stock idempotently", async () => {
    const { runMaintenance } = await import("../apps/api/src/maintenance.js");
    const { p, order } = await deliveryOrder();
    await db.order.update({
      where: { id: order.id },
      data: { reservationExpiresAt: new Date(Date.now() - 1000) },
    });
    await runMaintenance();
    await runMaintenance();
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("CANCELLED");
    const stock = await db.inventory.findFirstOrThrow({
      where: { variantId: p.variants[0]!.id },
    });
    expect(stock.onHand).toBe(5);
    expect(stock.reserved).toBe(0);
  });
  it("retains nonrefundable delivery fees in net analytics after a full goods return", async () => {
    const { command } = await import("../apps/api/src/retail.js"),
      { createReturnInTransaction } =
        await import("../apps/api/src/returns.js");
    const { order } = await deliveryOrder();
    await transitionOrder(actor(), order.id, "complete", key());
    await command(actor(), key(), { test: "shipping-refund" }, (tx) =>
      createReturnInTransaction(tx, actor(), {
        orderId: order.id,
        reason: "Return goods only",
        items: order.items.map((item) => ({
          orderItemId: item.id,
          quantity: item.quantity,
          restock: true,
        })),
      }),
    );
    const refunded = await db.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(refunded.status).toBe("REFUNDED");
    expect(refunded.total.minus(refunded.refundedTotal).toString()).toBe("5.5");
    const { analytics } = await import("../apps/api/src/analytics.js"),
      data = await analytics(a.id, 30);
    const expected = await db.order.findMany({
      where: {
        tenantId: a.id,
        status: { in: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] },
      },
    });
    expect(Number(data.revenue)).toBeCloseTo(
      expected.reduce(
        (sum, item) => sum + Number(item.total.minus(item.refundedTotal)),
        0,
      ),
      2,
    );
  });
  it("blocks deletion during delivery then anonymizes financial records and revokes sessions", async () => {
    const customer = await registerCustomer(),
      { order } = await deliveryOrder(customer.email);
    await merchant(`/orders/${order.id}/delivery`, {
      status: "SHIPPED",
    }).expect(200);
    const remove = () =>
      supertest(app)
        .delete(`${customerPath()}/account`)
        .set("Cookie", customer.cookie)
        .set("X-CSRF-Token", customer.csrf)
        .send({ password: "Customer-password-123" });
    await remove().expect(409);
    await transitionOrder(actor(), order.id, "complete", key());
    await remove().expect(200);
    await supertest(app)
      .get(`${customerPath()}/me`)
      .set("Cookie", customer.cookie)
      .expect(401);
    const deleted = await db.customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(deleted.passwordHash).toBeNull();
    expect(deleted.email).not.toBe(customer.email);
    const retained = await db.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(retained.customerName).toBe("Deleted customer");
    expect(retained.shippingAddress).toBeNull();
    expect(retained.total.toString()).toBe("26");
  });
});

describe("MySQL integration: staff, trials and support", () => {
  const inviteRequest = (email: string) =>
    supertest(app)
      .post("/api/v1/staff/invites")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({ email, role: "CASHIER" });
  it("accepts a single-use invite and revokes sessions after staff deactivation", async () => {
    const email = `invite-${key()}@example.test`,
      invite = await inviteRequest(email).expect(201),
      token = new URL(invite.body.url).searchParams.get("invite");
    const body = {
      token,
      email,
      name: "Invited Cashier",
      password: "Invited-password-123",
    };
    const accepted = await supertest(app)
      .post("/api/v1/auth/accept-invite")
      .send(body)
      .expect(201);
    expect(accepted.body.user.role).toBe("CASHIER");
    expect(accepted.body.user.tenantId).toBe(a.id);
    expect(accepted.text).not.toContain("passwordHash");
    await supertest(app)
      .post("/api/v1/auth/accept-invite")
      .send(body)
      .expect(404);
    const cookie = accepted.headers["set-cookie"][0].split(";")[0];
    await supertest(app)
      .patch(`/api/v1/staff/${accepted.body.user.id}`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({ active: false, role: "CASHIER" })
      .expect(200);
    await supertest(app)
      .get("/api/v1/products")
      .set("Cookie", cookie)
      .expect(401);
    await supertest(app)
      .post("/api/v1/auth/login")
      .send({ email, password: body.password })
      .expect(401);
  });
  it("enforces invite expiry, email, owner permissions and staff quotas", async () => {
    await supertest(app)
      .post("/api/v1/staff/invites")
      .set("Cookie", cashier.cookie)
      .set("X-CSRF-Token", cashier.csrf)
      .send({ email: `denied-${key()}@example.test`, role: "MANAGER" })
      .expect(403);
    const email = `expiring-${key()}@example.test`,
      invite = await inviteRequest(email).expect(201),
      token = new URL(invite.body.url).searchParams.get("invite");
    await supertest(app)
      .post("/api/v1/auth/accept-invite")
      .send({
        token,
        name: "Wrong email",
        email: "wrong@example.test",
        password: "Invited-password-123",
      })
      .expect(403);
    await db.staffInvite.update({
      where: { id: invite.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await supertest(app)
      .post("/api/v1/auth/accept-invite")
      .send({
        token,
        name: "Expired invite",
        email,
        password: "Invited-password-123",
      })
      .expect(404);
    await supertest(app)
      .patch(`/api/v1/staff/${a.userId}`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({ active: false, role: "CASHIER" })
      .expect(403);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: a.id } });
    await db.subscriptionPlan.update({
      where: { id: tenant.planId },
      data: { employeeLimit: 2 },
    });
    await inviteRequest(`limited-${key()}@example.test`).expect(403);
    await db.subscriptionPlan.update({
      where: { id: tenant.planId },
      data: { employeeLimit: 10 },
    });
  });
  it("prevents new commerce after trial expiry while allowing fulfilment and support", async () => {
    const p = await createProduct(actor(), product(a.storeId)),
      order = await checkout(
        actor(),
        {
          storeId: a.storeId,
          customerName: "Prior reservation",
          channel: "ONLINE",
          paymentMethod: "PICKUP",
          items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
        },
        key(),
      );
    await db.tenant.update({
      where: { id: a.id },
      data: {
        subscriptionStatus: "TRIAL",
        trialEndsAt: new Date(Date.now() - 1000),
      },
    });
    await expect(
      createProduct(actor(), product(a.storeId), key()),
    ).rejects.toMatchObject({ status: 403, code: "SUBSCRIPTION_REQUIRED" });
    await expect(
      checkout(
        actor(),
        {
          storeId: a.storeId,
          customerName: "Blocked sale",
          channel: "POS",
          paymentMethod: "CASH",
          items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
        },
        key(),
      ),
    ).rejects.toMatchObject({ status: 403, code: "SUBSCRIPTION_REQUIRED" });
    await supertest(app)
      .get("/api/v1/products")
      .set("Cookie", a.cookie)
      .expect(200);
    await supertest(app)
      .post(`/api/v1/orders/${order.id}/complete`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .set("Idempotency-Key", key())
      .send({})
      .expect(200);
    await supertest(app)
      .post("/api/v1/support")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({
        subject: "Subscription activation",
        body: "Please activate my workspace plan.",
        priority: "MEDIUM",
      })
      .expect(201);
    await db.tenant.update({
      where: { id: a.id },
      data: { subscriptionStatus: "ACTIVE", trialEndsAt: null },
    });
  });
  it("keeps support tickets tenant-scoped and hides private operator notes", async () => {
    const ticket = await supertest(app)
      .post("/api/v1/support")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({
        subject: "Private fixture request",
        body: "Original request",
        priority: "HIGH",
      })
      .expect(201);
    await supertest(app)
      .post(`/api/v1/support/${ticket.body.id}/messages`)
      .set("Cookie", b.cookie)
      .set("X-CSRF-Token", b.csrf)
      .send({ body: "Unauthorized message" })
      .expect(404);
    await db.supportMessage.create({
      data: {
        tenantId: a.id,
        ticketId: ticket.body.id,
        authorName: "Operator",
        actorId: "fixture-operator",
        internal: true,
        body: "Private operator investigation",
      },
    });
    const listing = await supertest(app)
      .get("/api/v1/support")
      .set("Cookie", a.cookie)
      .expect(200);
    expect(listing.text).not.toContain("Private operator investigation");
    await supertest(app)
      .get("/api/v1/platform/workspaces/support")
      .set("Cookie", a.cookie)
      .expect(403);
    const other = await supertest(app)
      .get("/api/v1/support")
      .set("Cookie", b.cookie)
      .expect(200);
    expect(other.text).not.toContain(ticket.body.id);
  });
});
describe("MySQL integration: durable virtual fitting", () => {
  let person: { id: string; token: string },
    garment: { id: string },
    photo: { id: string },
    image: Buffer;
  const aiActor = () => ({
    tenantId: a.id,
    id: person.id,
    role: "CASHIER" as const,
  });
  const path = () => `/api/v1/storefront/alpha-${suffix}/customer`;
  const input = () => ({
    productId: garment.id,
    photoId: photo.id,
    consent: true as const,
    adult: true as const,
  });
  const enqueue = (requestKey = key(), available = true, body = input()) =>
    command(aiActor(), requestKey, { type: "try-on", ...body }, (tx) =>
      enqueueTryOn(tx, aiActor(), body, available),
    );
  const provider = () => ({
    submit: async () => "fixture-" + key(),
    status: async () => "COMPLETED" as const,
    result: async () => image,
    cancel: async () => {},
  });
  async function fixture() {
    const { default: sharp } = await import("sharp");
    image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#aabbcc" },
    })
      .png()
      .toBuffer();
    const response = await supertest(app)
      .post(`${path()}/register`)
      .send({
        name: "Fitting Customer",
        phone: "+212612345678",
        email: `fitting-${key()}@example.test`,
        password: "Customer-password-123",
        termsAccepted: true,
        client: "native",
      })
      .expect(201);
    person = { id: response.body.customer.id, token: response.body.token };
    const p = await createProduct(actor(), product(a.storeId));
    const asset = await saveImage(actor(), image);
    garment = await db.product.update({
      where: { id: p.id },
      data: { tryOnEnabled: true, tryOnImageUrl: asset.url },
    });
    photo = await saveImage(aiActor(), image, person.id);
    const tenant = await db.tenant.update({
      where: { id: a.id },
      data: { tryOnEnabled: true },
    });
    await db.subscriptionPlan.update({
      where: { id: tenant.planId },
      data: { aiCredits: 100 },
    });
  }
  afterEach(async () => {
    await db.tryOnJob.updateMany({
      where: {
        tenantId: a.id,
        status: { in: ["QUEUED", "SUBMITTING", "PROCESSING"] },
      },
      data: { expiresAt: new Date(Date.now() - 1000), leaseUntil: null },
    });
    await runTryOnJobs(null);
  });
  it("keeps unconfigured providers disabled without charging credits", async () => {
    await fixture();
    await expect(enqueue(key(), false)).rejects.toMatchObject({
      code: "AI_UNCONFIGURED",
    });
    expect(
      await db.aICreditEntry.count({
        where: { tenantId: a.id, job: { customerId: person.id } },
      }),
    ).toBe(0);
    const capability = await supertest(app)
      .get(`/api/v1/storefront/alpha-${suffix}/try-on`)
      .expect(200);
    expect(capability.body.enabled).toBe(false);
    await supertest(app)
      .put("/api/v1/ai")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({ enabled: true })
      .expect(503);
  });
  it("charges one credit on retry and rejects another customer's photo", async () => {
    await fixture();
    const requestKey = key(),
      job = await enqueue(requestKey),
      retry = await enqueue(requestKey);
    expect(retry.id).toBe(job.id);
    expect(
      await db.aICreditEntry.count({
        where: { jobId: job.id, type: "CHARGE" },
      }),
    ).toBe(1);
    await expect(enqueue()).rejects.toMatchObject({ code: "PHOTO_IN_USE" });
    const other = await db.customer.create({
      data: {
        tenantId: a.id,
        name: "Other fitting customer",
        email: `other-fitting-${key()}@example.test`,
      },
    });
    const otherPhoto = await saveImage(
      { ...aiActor(), id: other.id },
      image,
      other.id,
    );
    await expect(
      enqueue(key(), true, { ...input(), photoId: otherPhoto.id }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("enforces the monthly quota under concurrent requests", async () => {
    await fixture();
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: a.id } }),
      period = new Date().toISOString().slice(0, 7),
      usage = await db.aIUsage.findUnique({
        where: { tenantId_period: { tenantId: a.id, period } },
      });
    await db.subscriptionPlan.update({
      where: { id: tenant.planId },
      data: { aiCredits: (usage?.used ?? 0) + 1 },
    });
    const second = await saveImage(aiActor(), image, person.id);
    const results = await Promise.allSettled([
      enqueue(),
      enqueue(key(), true, { ...input(), photoId: second.id }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: { code: "AI_CREDIT_LIMIT" } });
  });
  it("completes jobs using private output and purges deleted photos", async () => {
    await fixture();
    const job = await enqueue();
    await runTryOnJobs(provider());
    await runTryOnJobs(provider());
    const completed = await db.tryOnJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.outputId).toBeTruthy();
    await supertest(app).get(`/api/v1/media/${completed.outputId}`).expect(404);
    await supertest(app)
      .get(`${path()}/media/${completed.outputId}`)
      .set("Authorization", `Bearer ${person.token}`)
      .expect(200);
    await supertest(app)
      .delete(`${path()}/try-on/${job.id}`)
      .set("Authorization", `Bearer ${person.token}`)
      .expect(200);
    await supertest(app)
      .get(`${path()}/media/${completed.outputId}`)
      .set("Authorization", `Bearer ${person.token}`)
      .expect(404);
    expect(
      (
        await db.mediaAsset.findUniqueOrThrow({
          where: { id: completed.outputId! },
        })
      ).bytes,
    ).toBe(0);
  });
  it("refunds provider failures once and never resubmits an uncertain job", async () => {
    await fixture();
    const job = await enqueue();
    await runTryOnJobs({
      ...provider(),
      submit: async () => {
        throw new Error("Fixture provider unavailable");
      },
    });
    await runTryOnJobs(provider());
    expect(
      (await db.tryOnJob.findUniqueOrThrow({ where: { id: job.id } }))
        .creditedBack,
    ).toBe(true);
    expect(
      await db.aICreditEntry.count({
        where: { jobId: job.id, type: "REFUND" },
      }),
    ).toBe(1);
    const nextPhoto = await saveImage(aiActor(), image, person.id),
      uncertain = await enqueue(key(), true, {
        ...input(),
        photoId: nextPhoto.id,
      });
    await db.tryOnJob.update({
      where: { id: uncertain.id },
      data: { status: "SUBMITTING", leaseUntil: new Date(Date.now() - 1000) },
    });
    let submitted = 0;
    await runTryOnJobs({
      ...provider(),
      submit: async () => {
        submitted++;
        return "must-not-submit";
      },
    });
    expect(submitted).toBe(0);
    expect(
      (await db.tryOnJob.findUniqueOrThrow({ where: { id: uncertain.id } }))
        .errorCode,
    ).toBe("SUBMISSION_UNCERTAIN");
  });
  it("returns unused queued credits when a customer deletes a preview", async () => {
    await fixture();
    const job = await enqueue();
    await supertest(app)
      .delete(`${path()}/try-on/${job.id}`)
      .set("Authorization", `Bearer ${person.token}`)
      .expect(200);
    const cancelled = await db.tryOnJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.creditedBack).toBe(true);
    expect(
      await db.aICreditEntry.count({
        where: { jobId: job.id, type: "REFUND" },
      }),
    ).toBe(1);
    await supertest(app)
      .delete(`${path()}/try-on/${job.id}`)
      .set("Authorization", `Bearer ${person.token}`)
      .expect(404);
  });
});
describe("MySQL integration: cash registers and promotions", () => {
  const merchant = (path: string, body: unknown, requestKey = key()) =>
    supertest(app)
      .post(`/api/v1${path}`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .set("Idempotency-Key", requestKey)
      .send(body);
  it("reconciles cash sales, returns, movements and closing variance", async () => {
    await supertest(app)
      .put("/api/v1/registers/config")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({ required: true })
      .expect(200);
    const p = await createProduct(actor(), product(a.storeId));
    const input = {
      storeId: a.storeId,
      customerName: "Register Customer",
      channel: "POS" as const,
      paymentMethod: "CASH" as const,
      items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
    };
    await expect(checkout(actor(), input, key())).rejects.toMatchObject({
      code: "REGISTER_CLOSED",
    });
    const openingKey = key(),
      opened = await merchant(
        "/registers/open",
        { storeId: a.storeId, openingCash: "100.00" },
        openingKey,
      ).expect(201);
    const retry = await merchant(
      "/registers/open",
      { storeId: a.storeId, openingCash: "100.00" },
      openingKey,
    ).expect(201);
    expect(retry.body.id).toBe(opened.body.id);
    await merchant("/registers/open", {
      storeId: a.storeId,
      openingCash: "100.00",
    }).expect(409);
    const order = await checkout(actor(), input, key());
    await transitionOrder(actor(), order.id, "refund", key());
    await merchant(`/registers/${opened.body.id}/movements`, {
      type: "OUT",
      amount: "10.00",
      reason: "Petty cash",
    }).expect(201);
    await merchant(`/registers/${opened.body.id}/movements`, {
      type: "OUT",
      amount: "100.00",
      reason: "Too much cash",
    }).expect(409);
    const ledger = await supertest(app)
      .get(`/api/v1/registers/${opened.body.id}`)
      .set("Cookie", a.cookie)
      .expect(200);
    expect(ledger.body.balance).toBe("90");
    expect(
      ledger.body.movements.map((row: { type: string }) => row.type),
    ).toEqual(expect.arrayContaining(["OPENING", "SALE", "REFUND", "OUT"]));
    await supertest(app)
      .get(`/api/v1/registers/${opened.body.id}`)
      .set("Cookie", b.cookie)
      .expect(404);
    const closed = await merchant(`/registers/${opened.body.id}/close`, {
      countedCash: "89.50",
      note: "Coin discrepancy",
    }).expect(200);
    expect(closed.body.variance).toBe("-0.5");
    expect(closed.body.expectedCash).toBe("90");
    await merchant(`/registers/${opened.body.id}/movements`, {
      type: "IN",
      amount: "1.00",
      reason: "Closed register",
    }).expect(404);
    await supertest(app)
      .put("/api/v1/registers/config")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({ required: false })
      .expect(200);
  });
  it("enforces promotion use limits atomically and releases cancelled reservations", async () => {
    const code = `PROMO-${suffix}`;
    const created = await merchant("/coupons", {
      code,
      name: "Fixture promotion",
      kind: "PERCENT",
      value: "10",
      minimum: "10.00",
      maximumUses: 1,
      channel: "ALL",
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    }).expect(201);
    const p = await createProduct(actor(), product(a.storeId));
    const input = {
      storeId: a.storeId,
      customerName: "Promotion customer",
      channel: "ONLINE" as const,
      paymentMethod: "PICKUP" as const,
      couponCode: code,
      items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
    };
    const outcomes = await Promise.allSettled([
      checkout(actor(), input, key()),
      checkout(actor(), input, key()),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    const sale = outcomes.find((outcome) => outcome.status === "fulfilled")!;
    if (sale.status !== "fulfilled")
      throw new Error("Missing promotion fixture");
    expect(sale.value.discountTotal.toFixed(2)).toBe("1.02");
    expect(sale.value.total.toFixed(2)).toBe("9.23");
    await transitionOrder(actor(), sale.value.id, "cancel", key());
    expect(
      (await db.coupon.findUniqueOrThrow({ where: { id: created.body.id } }))
        .used,
    ).toBe(0);
    const bought = await checkout(
      actor(),
      { ...input, channel: "POS", paymentMethod: "CASH" },
      key(),
    );
    await transitionOrder(actor(), bought.id, "refund", key());
    expect(
      (await db.coupon.findUniqueOrThrow({ where: { id: created.body.id } }))
        .used,
    ).toBe(1);
    await expect(
      checkout(actor(), { ...input, rewardCode: "RW-COMBINED" }, key()),
    ).rejects.toMatchObject({ code: "DISCOUNT_COMBINATION" });
    await expect(
      checkout(
        { tenantId: b.id, id: b.userId, role: "OWNER" },
        { ...input, storeId: b.storeId },
        key(),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("supports exact barcode search and reports the actual cashier", async () => {
    const p = await createProduct(actor(), product(a.storeId));
    const barcode = `BAR-${key()}`;
    await db.productVariant.update({
      where: { id: p.variants[0]!.id },
      data: { barcode },
    });
    const found = await supertest(app)
      .get(`/api/v1/products?q=${barcode}`)
      .set("Cookie", a.cookie)
      .expect(200);
    expect(found.body.items.map((row: { id: string }) => row.id)).toContain(
      p.id,
    );
    await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: "Cashier report",
        channel: "POS",
        paymentMethod: "CASH",
        items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
      },
      key(),
    );
    const report = await supertest(app)
      .get("/api/v1/cashier-report")
      .set("Cookie", a.cookie)
      .expect(200);
    expect(
      report.body.find(
        (row: { cashierId: string }) => row.cashierId === a.userId,
      ).sales,
    ).toBeGreaterThan(0);
    await supertest(app)
      .get("/api/v1/cashier-report")
      .set("Cookie", cashier.cookie)
      .expect(403);
  });
});
describe("MySQL integration: CRM, campaigns and loyalty bonuses", () => {
  const path = () => `/api/v1/storefront/alpha-${suffix}/customer`;
  async function memberFixture(enroll = true, referralCode?: string) {
    const { randomBytes } = await import("node:crypto"),
      { tokenHash } = await import("../apps/api/src/customer-auth.js");
    const customer = await db.customer.create({
      data: {
        tenantId: a.id,
        name: "CRM fixture",
        email: `crm-${key()}@example.test`,
        phone: "+212612345678",
        passwordHash: await hashPassword("Customer-password-123"),
      },
    });
    const token = randomBytes(32).toString("hex");
    await db.customerSession.create({
      data: {
        id: tokenHash(token),
        tenantId: a.id,
        customerId: customer.id,
        csrfToken: randomBytes(32).toString("hex"),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    if (enroll) {
      await db.loyaltyProgram.upsert({
        where: { tenantId: a.id },
        update: { enabled: true, birthdayPoints: 25, referralPoints: 40 },
        create: {
          tenantId: a.id,
          enabled: true,
          birthdayPoints: 25,
          referralPoints: 40,
        },
      });
      await supertest(app)
        .post(`${path()}/loyalty/enroll`)
        .set("Authorization", `Bearer ${token}`)
        .send({ consent: true, ...(referralCode ? { referralCode } : {}) })
        .expect(201);
    }
    return { ...customer, token };
  }
  it("protects manager notes and derives customer value from refunded sales", async () => {
    const customer = await memberFixture(false),
      p = await createProduct(actor(), product(a.storeId));
    const order = await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: customer.name,
        email: customer.email,
        channel: "POS",
        paymentMethod: "CASH",
        items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
      },
      key(),
    );
    await transitionOrder(actor(), order.id, "refund", key());
    await supertest(app)
      .patch(`/api/v1/crm/customers/${customer.id}`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({ notes: "Manager-only fixture note" })
      .expect(200);
    const profile = await supertest(app)
      .get(`/api/v1/crm/customers/${customer.id}`)
      .set("Cookie", a.cookie)
      .expect(200);
    expect(profile.body.summary.lifetimeNetSales).toBe("0");
    expect(profile.body.summary.fulfilledPurchases).toBe(0);
    expect(profile.body.customer.notes).toBe("Manager-only fixture note");
    expect(profile.text).not.toContain("passwordHash");
    await supertest(app)
      .get(`/api/v1/crm/customers/${customer.id}`)
      .set("Cookie", cashier.cookie)
      .expect(403);
    await supertest(app)
      .get(`/api/v1/crm/customers/${customer.id}`)
      .set("Cookie", b.cookie)
      .expect(404);
    const directory = await supertest(app)
      .get(`/api/v1/customers?q=${customer.email}`)
      .set("Cookie", cashier.cookie)
      .expect(200);
    expect(directory.text).not.toContain("Manager-only fixture note");
    await supertest(app)
      .put(`${path()}/preferences`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        sizes: ["M"],
        categories: ["Shirts"],
        preferredStoreId: b.storeId,
      })
      .expect(404);
    await supertest(app)
      .put(`${path()}/preferences`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        sizes: ["M"],
        categories: ["Shirts"],
        preferredStoreId: a.storeId,
      })
      .expect(200);
  });
  it("sends campaigns only to opted-in accounts and prevents duplicate deliveries", async () => {
    const opted = await memberFixture(false),
      notOpted = await memberFixture(false),
      { runCampaigns } = await import("../apps/api/src/crm-campaigns.js");
    await supertest(app)
      .put(`${path()}/consents`)
      .set("Authorization", `Bearer ${opted.token}`)
      .send({ purpose: "IN_APP_MARKETING", granted: true })
      .expect(200);
    const campaign = await supertest(app)
      .post("/api/v1/campaigns")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .set("Idempotency-Key", key())
      .send({
        name: "Fixture collection launch",
        title: "A new collection",
        body: "Discover this fixture collection.",
        segment: "ALL",
        scheduledAt: null,
      })
      .expect(201);
    expect(
      await db.campaignDelivery.count({
        where: { campaignId: campaign.body.id },
      }),
    ).toBe(0);
    await supertest(app)
      .post(`/api/v1/campaigns/${campaign.body.id}/publish`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .set("Idempotency-Key", key())
      .send({})
      .expect(200);
    await runCampaigns();
    await runCampaigns();
    expect(
      await db.campaignDelivery.count({
        where: { campaignId: campaign.body.id, customerId: opted.id },
      }),
    ).toBe(1);
    expect(
      await db.campaignDelivery.count({
        where: { campaignId: campaign.body.id, customerId: notOpted.id },
      }),
    ).toBe(0);
    expect(
      await db.notification.count({
        where: {
          tenantId: a.id,
          customerId: opted.id,
          title: "A new collection",
        },
      }),
    ).toBe(1);
    const privateList = await supertest(app)
      .get("/api/v1/campaigns")
      .set("Cookie", b.cookie)
      .expect(200);
    expect(privateList.text).not.toContain(campaign.body.id);
  });
  it("awards birthday points once per Moroccan calendar year", async () => {
    const customer = await memberFixture(),
      { moroccoDate } = await import("../apps/api/src/loyalty-bonuses.js");
    await db.customer.update({
      where: { id: customer.id },
      data: { birthday: new Date(`2000-${moroccoDate().slice(5)}T00:00:00Z`) },
    });
    const first = await supertest(app)
      .get(`${path()}/loyalty`)
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);
    const second = await supertest(app)
      .get(`${path()}/loyalty`)
      .set("Authorization", `Bearer ${customer.token}`)
      .expect(200);
    expect(first.body.account.points).toBe(25);
    expect(second.body.account.points).toBe(25);
    expect(
      await db.loyaltyEntry.count({
        where: {
          tenantId: a.id,
          accountId: first.body.account.id,
          type: "BIRTHDAY",
        },
      }),
    ).toBe(1);
  });
  it("awards referrals on fulfilment and reverses them on return", async () => {
    const referrer = await memberFixture(),
      account = await db.loyaltyAccount.findUniqueOrThrow({
        where: {
          tenantId_customerId: { tenantId: a.id, customerId: referrer.id },
        },
      }),
      referred = await memberFixture(true, account.cardCode),
      p = await createProduct(actor(), product(a.storeId));
    const order = await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: referred.name,
        email: referred.email,
        channel: "POS",
        paymentMethod: "CASH",
        items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
      },
      key(),
    );
    expect(
      (await db.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } }))
        .points,
    ).toBe(40);
    await transitionOrder(actor(), order.id, "refund", key());
    expect(
      (await db.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } }))
        .points,
    ).toBe(0);
    await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: referred.name,
        email: referred.email,
        channel: "POS",
        paymentMethod: "CASH",
        items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
      },
      key(),
    );
    expect(
      (await db.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } }))
        .points,
    ).toBe(0);
  });
  it("reverses zero-sale-point referral bonuses after a plan disables loyalty without issuing new awards", async () => {
    const { Prisma } = await import("@prisma/client");
    const referrer = await memberFixture(),
      account = await db.loyaltyAccount.findUniqueOrThrow({
        where: {
          tenantId_customerId: { tenantId: a.id, customerId: referrer.id },
        },
      }),
      referred = await memberFixture(true, account.cardCode);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: a.id } }),
      plan = await db.subscriptionPlan.findUniqueOrThrow({
        where: { id: tenant.planId },
      }),
      program = await db.loyaltyProgram.findUniqueOrThrow({
        where: { tenantId: a.id },
      });
    const p = await createProduct(actor(), product(a.storeId));
    await db.loyaltyProgram.update({
      where: { tenantId: a.id },
      data: { spendUnit: "1000.00" },
    });
    const input = {
      storeId: a.storeId,
      customerName: referred.name,
      email: referred.email,
      channel: "POS" as const,
      paymentMethod: "CASH" as const,
      items: [{ variantId: p.variants[0]!.id, quantity: 1 }],
    };
    try {
      const sale = await checkout(actor(), input, key());
      expect(sale.loyaltyPoints).toBe(0);
      expect(
        (
          await db.loyaltyAccount.findUniqueOrThrow({
            where: { id: account.id },
          })
        ).points,
      ).toBe(40);
      await db.subscriptionPlan.update({
        where: { id: plan.id },
        data: { features: [] },
      });
      await transitionOrder(actor(), sale.id, "refund", key());
      expect(
        (
          await db.loyaltyAccount.findUniqueOrThrow({
            where: { id: account.id },
          })
        ).points,
      ).toBe(0);
      const another = await checkout(actor(), input, key());
      await transitionOrder(actor(), another.id, "refund", key());
      expect(
        await db.loyaltyEntry.count({
          where: { tenantId: a.id, orderId: another.id, points: { gt: 0 } },
        }),
      ).toBe(0);
    } finally {
      await db.subscriptionPlan.update({
        where: { id: plan.id },
        data: { features: plan.features ?? Prisma.DbNull },
      });
      await db.loyaltyProgram.update({
        where: { tenantId: a.id },
        data: { spendUnit: program.spendUnit },
      });
    }
  });
  it("does not subtract expired referral points again on partial and full returns", async () => {
    const referrer = await memberFixture(),
      account = await db.loyaltyAccount.findUniqueOrThrow({
        where: {
          tenantId_customerId: { tenantId: a.id, customerId: referrer.id },
        },
      }),
      referred = await memberFixture(true, account.cardCode),
      p = await createProduct(actor(), product(a.storeId)),
      { expirePoints } = await import("../apps/api/src/loyalty.js"),
      { createReturnInTransaction } =
        await import("../apps/api/src/returns.js");
    const order = await checkout(
      actor(),
      {
        storeId: a.storeId,
        customerName: referred.name,
        email: referred.email,
        channel: "POS",
        paymentMethod: "CASH",
        items: [{ variantId: p.variants[0]!.id, quantity: 2 }],
      },
      key(),
    );
    await db.loyaltyEntry.updateMany({
      where: { accountId: account.id, type: "REFERRAL" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await command(actor(), key(), { type: "expire-referral" }, async (tx) => {
      await expirePoints(tx, a.id, account.id);
      return { ok: true };
    });
    await command(actor(), key(), { type: "partial-referral-return" }, (tx) =>
      createReturnInTransaction(tx, actor(), {
        orderId: order.id,
        reason: "Fixture partial return",
        items: [
          { orderItemId: order.items[0]!.id, quantity: 1, restock: true },
        ],
      }),
    );
    await transitionOrder(actor(), order.id, "refund", key());
    const result = await db.loyaltyAccount.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(result.points).toBe(0);
    expect(result.lifetimePoints).toBe(0);
  });
});
describe("MySQL integration: subscription invoices and verified billing", () => {
  let operator: { id: string; cookie: string; csrf: string };
  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        name: "Fixture Operator",
        email: `billing-operator-${suffix}@example.test`,
        passwordHash: await hashPassword("Operator-password-123"),
        role: "PLATFORM_ADMIN",
      },
    });
    const login = await supertest(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "Operator-password-123" })
      .expect(200);
    operator = {
      id: user.id,
      cookie: login.headers["set-cookie"][0].split(";")[0],
      csrf: login.body.csrfToken,
    };
  });
  afterAll(async () => {
    if (operator) {
      await db.platformAudit.deleteMany({ where: { actorId: operator.id } });
      await db.user.delete({ where: { id: operator.id } });
    }
  });
  it("protects operator controls, rejects unsafe plan reductions and revokes disabled operator sessions", async () => {
    await supertest(app)
      .get("/api/v1/platform/control")
      .set("Cookie", a.cookie)
      .expect(403);
    const control = await supertest(app)
      .get("/api/v1/platform/control")
      .set("Cookie", operator.cookie)
      .expect(200);
    expect(JSON.stringify(control.body)).not.toContain("passwordHash");
    expect(control.body.features).toContain("AR");
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: a.id } });
    await supertest(app)
      .patch(`/api/v1/platform/control/plans/${tenant.planId}`)
      .set("Cookie", operator.cookie)
      .set("X-CSRF-Token", operator.csrf)
      .send({ productLimit: 1 })
      .expect(409);
    await supertest(app)
      .patch(`/api/v1/platform/control/users/${operator.id}`)
      .set("Cookie", operator.cookie)
      .set("X-CSRF-Token", operator.csrf)
      .send({ active: false })
      .expect(409);
    const email = `operator-control-${key()}@example.test`,
      password = "Control-password-123";
    const created = await supertest(app)
      .post("/api/v1/platform/control/users")
      .set("Cookie", operator.cookie)
      .set("X-CSRF-Token", operator.csrf)
      .send({ name: "Control fixture", email, password })
      .expect(201);
    try {
      const login = await supertest(app)
        .post("/api/v1/auth/login")
        .send({ email, password })
        .expect(200);
      await supertest(app)
        .patch(`/api/v1/platform/control/users/${created.body.id}`)
        .set("Cookie", operator.cookie)
        .set("X-CSRF-Token", operator.csrf)
        .send({ active: false })
        .expect(200);
      await supertest(app)
        .get("/api/v1/auth/me")
        .set("Cookie", login.headers["set-cookie"][0].split(";")[0])
        .expect(401);
    } finally {
      await db.user.delete({ where: { id: created.body.id } });
    }
  });
  const op = (path: string, body: unknown, requestKey = key()) =>
    supertest(app)
      .post(`/api/v1/platform/billing${path}`)
      .set("Cookie", operator.cookie)
      .set("X-CSRF-Token", operator.csrf)
      .set("Idempotency-Key", requestKey)
      .send(body);
  async function invoice(planId?: string) {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: a.id } });
    return op("", {
      tenantId: a.id,
      planId: planId ?? tenant.planId,
      months: 1,
      periodStart: new Date(Date.now() - 86400000).toISOString(),
    }).expect(201);
  }
  it("records manual payments once and keeps invoice access tenant-scoped", async () => {
    const created = await invoice(),
      requestKey = key(),
      payment = {
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "TEST-BANK-REFERENCE",
        confirmedReceived: true,
      };
    const paid = await op(
        `/${created.body.id}/pay`,
        payment,
        requestKey,
      ).expect(200),
      retried = await op(`/${created.body.id}/pay`, payment, requestKey).expect(
        200,
      );
    expect(paid.body.status).toBe("PAID");
    expect(paid.body.activationStatus).toBe("APPLIED");
    expect(retried.body.id).toBe(paid.body.id);
    expect(
      (
        await db.tenant.findUniqueOrThrow({ where: { id: a.id } })
      ).paidThrough?.toISOString(),
    ).toBe(created.body.periodEnd);
    const other = await supertest(app)
      .get("/api/v1/billing")
      .set("Cookie", b.cookie)
      .expect(200);
    expect(other.text).not.toContain(created.body.id);
    await supertest(app)
      .post("/api/v1/platform/billing")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .send({})
      .expect(403);
    await op(`/${created.body.id}/pay`, payment).expect(404);
  });
  it("verifies raw webhook signatures, amounts and repeated deliveries", async () => {
    const created = await invoice(),
      { default: Stripe } = await import("stripe"),
      old = {
        key: process.env.STRIPE_SECRET_KEY,
        secret: process.env.STRIPE_WEBHOOK_SECRET,
        approved: process.env.BILLING_PROVIDER_APPROVED,
      },
      secret = "whsec_fixture_only";
    await db.subscriptionInvoice.update({
      where: { id: created.body.id },
      data: { checkoutSessionId: "cs_test_fixture" },
    });
    try {
      process.env.STRIPE_SECRET_KEY = "sk_test_fixture_only";
      process.env.STRIPE_WEBHOOK_SECRET = secret;
      process.env.BILLING_PROVIDER_APPROVED = "true";
      const object = {
        id: "cs_test_fixture",
        object: "checkout.session",
        payment_status: "paid",
        mode: "payment",
        client_reference_id: created.body.id,
        metadata: { invoiceId: created.body.id },
        currency: "mad",
        amount_total: Math.round(Number(created.body.amount) * 100),
      };
      const send = (
        eventId: string,
        amount = object.amount_total,
        valid = true,
      ) => {
        const payload = JSON.stringify({
            id: eventId,
            object: "event",
            type: "checkout.session.completed",
            created: Math.floor(Date.now() / 1000),
            data: { object: { ...object, amount_total: amount } },
          }),
          signature = Stripe.webhooks.generateTestHeaderString({
            payload,
            secret: valid ? secret : "wrong_fixture_secret",
          });
        return supertest(app)
          .post("/api/v1/billing/stripe/webhook")
          .set("Content-Type", "application/json")
          .set("Stripe-Signature", signature)
          .send(payload);
      };
      await send("evt_bad_signature", undefined, false).expect(400);
      const mismatch = await send("evt_wrong_amount", 1).expect(200);
      expect(mismatch.body.status).toBe("PAYMENT_REVIEW");
      expect(
        (
          await db.subscriptionInvoice.findUniqueOrThrow({
            where: { id: created.body.id },
          })
        ).status,
      ).toBe("PENDING");
      await send("evt_verified_fixture").expect(200);
      const duplicate = await send("evt_verified_fixture").expect(200);
      expect(duplicate.body.duplicate).toBe(true);
      const completed = await db.subscriptionInvoice.findUniqueOrThrow({
        where: { id: created.body.id },
      });
      expect(completed.status).toBe("PAID");
      expect(completed.paymentMethod).toBe("STRIPE");
      expect(
        await db.billingEvent.count({
          where: { invoiceId: created.body.id, id: "evt_verified_fixture" },
        }),
      ).toBe(1);
    } finally {
      if (old.key === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = old.key;
      if (old.secret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = old.secret;
      if (old.approved === undefined)
        delete process.env.BILLING_PROVIDER_APPROVED;
      else process.env.BILLING_PROVIDER_APPROVED = old.approved;
    }
  });
  it("retains paid invoices for review when a downgraded plan would violate limits", async () => {
    const plan = await db.subscriptionPlan.create({
      data: {
        name: `Tiny invoice plan-${suffix}`,
        monthlyPrice: "10.00",
        productLimit: 1,
        storeLimit: 1,
        employeeLimit: 1,
      },
    });
    planIds.push(plan.id);
    const created = await invoice(plan.id),
      tenantBefore = await db.tenant.findUniqueOrThrow({ where: { id: a.id } });
    const paid = await op(`/${created.body.id}/pay`, {
      paymentMethod: "CASH",
      paymentReference: "TEST-DOWNGRADE-PAYMENT",
      confirmedReceived: true,
    }).expect(200);
    expect(paid.body.status).toBe("PAID");
    expect(paid.body.activationStatus).toBe("LIMIT_REVIEW");
    expect(
      (await db.tenant.findUniqueOrThrow({ where: { id: a.id } })).planId,
    ).toBe(tenantBefore.planId);
  });
  it("blocks commerce after a paid period expires while allowing billing recovery", async () => {
    await db.tenant.update({
      where: { id: a.id },
      data: {
        subscriptionStatus: "ACTIVE",
        paidThrough: new Date(Date.now() - 1000),
      },
    });
    await expect(
      createProduct(actor(), product(a.storeId)),
    ).rejects.toMatchObject({ code: "SUBSCRIPTION_REQUIRED" });
    const created = await invoice();
    await supertest(app)
      .post(`/api/v1/billing/${created.body.id}/checkout`)
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .set("Idempotency-Key", key())
      .send({})
      .expect(503);
    await op(`/${created.body.id}/pay`, {
      paymentMethod: "BANK_TRANSFER",
      paymentReference: "TEST-RENEWAL",
      confirmedReceived: true,
    }).expect(200);
    expect(
      (
        await db.tenant.findUniqueOrThrow({ where: { id: a.id } })
      ).paidThrough!.getTime(),
    ).toBeGreaterThan(Date.now());
  });
  it("clamps monthly periods correctly at the end of a month", async () => {
    const { periodEnd } = await import("../apps/api/src/billing.js");
    expect(periodEnd(new Date("2026-01-31T12:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T12:00:00.000Z",
    );
  });
});

describe("MySQL integration: recurring subscription reconciliation", () => {
  async function enrollment() {
    const plan = await db.subscriptionPlan.create({
      data: {
        name: `Recurring-${key()}`,
        monthlyPrice: "120.00",
        productLimit: 100,
        storeLimit: 10,
      },
    });
    planIds.push(plan.id);
    const tenant = await db.tenant.create({
      data: {
        name: "Recurring fixture",
        slug: `recurring-${key()}`,
        planId: plan.id,
        subscriptionStatus: "TRIAL",
        trialEndsAt: new Date(Date.now() - 1000),
      },
    });
    tenantIds.push(tenant.id);
    const actor = {
      tenantId: tenant.id,
      id: "fixture-owner",
      role: "OWNER" as const,
    };
    const { prepareRecurringBilling } =
      await import("../apps/api/src/recurring-billing.js");
    const saved = await prepareRecurringBilling(actor, plan.id, key());
    const metadata = {
      recurringId: saved.id,
      tenantId: tenant.id,
      attemptKey: saved.attemptKey,
    };
    const customerId = `cus_${key()}`,
      subscriptionId = `sub_${key()}`;
    return { actor, plan, saved, metadata, customerId, subscriptionId };
  }
  type Enrollment = Awaited<ReturnType<typeof enrollment>>;
  async function send(
    type: string,
    object: Record<string, unknown>,
    created = Math.floor(Date.now() / 1000),
    id = `evt_${key()}`,
  ) {
    const { processBillingEvent } = await import("../apps/api/src/billing.js");
    return processBillingEvent({
      id,
      object: "event",
      type,
      created,
      data: { object },
    } as unknown as import("stripe").default.Event);
  }
  function invoice(fixture: Enrollment, extra: Record<string, unknown> = {}) {
    const start = Math.floor(Date.now() / 1000) - 10;
    return {
      id: `in_${key()}`,
      object: "invoice",
      customer: fixture.customerId,
      parent: {
        subscription_details: {
          subscription: fixture.subscriptionId,
          metadata: fixture.metadata,
        },
      },
      status: "paid",
      amount_paid: 12000,
      amount_remaining: 0,
      total: 12000,
      currency: "mad",
      billing_reason: "subscription_create",
      status_transitions: { paid_at: start + 5 },
      lines: {
        has_more: false,
        data: [
          {
            amount: 12000,
            quantity: 1,
            period: { start, end: start + 30 * 86400 },
            parent: {
              subscription_item_details: {
                subscription: fixture.subscriptionId,
                proration: false,
              },
            },
          },
        ],
      },
      ...extra,
    };
  }
  it("serializes enrollment retries and rejects a simultaneous second plan", async () => {
    const fixture = await enrollment(),
      { prepareRecurringBilling } =
        await import("../apps/api/src/recurring-billing.js");
    const repeated = await Promise.all([
      prepareRecurringBilling(fixture.actor, fixture.plan.id, key()),
      prepareRecurringBilling(fixture.actor, fixture.plan.id, key()),
    ]);
    expect(repeated.map((row) => row.id)).toEqual([
      fixture.saved.id,
      fixture.saved.id,
    ]);
    expect(
      await db.recurringBilling.count({
        where: { tenantId: fixture.actor.tenantId },
      }),
    ).toBe(1);
    const other = await db.subscriptionPlan.findFirstOrThrow({
      where: { id: { not: fixture.plan.id } },
    });
    await expect(
      prepareRecurringBilling(fixture.actor, other.id, key()),
    ).rejects.toMatchObject({ code: "RECURRING_EXISTS" });
  });
  it("binds Checkout without granting access and reconciles invoices delivered before Checkout", async () => {
    const first = await enrollment();
    await send("checkout.session.completed", {
      id: `cs_${key()}`,
      mode: "subscription",
      payment_status: "paid",
      customer: first.customerId,
      subscription: first.subscriptionId,
      client_reference_id: first.saved.id,
      metadata: first.metadata,
    });
    expect(
      (
        await db.tenant.findUniqueOrThrow({
          where: { id: first.actor.tenantId },
        })
      ).paidThrough,
    ).toBeNull();
    const second = await enrollment(),
      paid = invoice(second);
    expect(await send("invoice.paid", paid)).toMatchObject({
      status: "APPLIED",
    });
    const tenant = await db.tenant.findUniqueOrThrow({
      where: { id: second.actor.tenantId },
    });
    expect(tenant.subscriptionStatus).toBe("ACTIVE");
    expect(tenant.paidThrough!.getTime()).toBe(
      paid.lines.data[0]!.period.end * 1000,
    );
    await send("checkout.session.completed", {
      id: `cs_${key()}`,
      mode: "subscription",
      customer: second.customerId,
      subscription: second.subscriptionId,
      client_reference_id: second.saved.id,
      metadata: second.metadata,
    });
    expect(
      await db.subscriptionInvoice.count({
        where: { tenantId: second.actor.tenantId },
      }),
    ).toBe(1);
  });
  it("uses the consented price snapshot and applies a provider invoice only once", async () => {
    const fixture = await enrollment(),
      paid = invoice(fixture),
      eventId = `evt_${key()}`;
    await db.subscriptionPlan.update({
      where: { id: fixture.plan.id },
      data: { monthlyPrice: "999.00" },
    });
    const now = Math.floor(Date.now() / 1000);
    await send("invoice.paid", paid, now, eventId);
    expect(await send("invoice.paid", paid, now, eventId)).toMatchObject({
      duplicate: true,
    });
    expect(await send("invoice.paid", paid)).toMatchObject({
      status: "DUPLICATE_INVOICE",
    });
    const invoices = await db.subscriptionInvoice.findMany({
      where: { tenantId: fixture.actor.tenantId },
    });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]!.amount.toFixed(2)).toBe("120.00");
    expect(invoices[0]!.paymentMethod).toBe("STRIPE_RECURRING");
  });
  it("holds wrong amounts, currencies, bindings and invalid service periods for review", async () => {
    const fixture = await enrollment();
    expect(
      await send("invoice.paid", invoice(fixture, { amount_paid: 1 })),
    ).toMatchObject({ status: "PAYMENT_REVIEW" });
    expect(
      await send("invoice.paid", invoice(fixture, { currency: "usd" })),
    ).toMatchObject({ status: "PAYMENT_REVIEW" });
    expect(
      await send(
        "invoice.paid",
        invoice(fixture, { customer: "cus_wrong_tenant" }),
      ),
    ).toMatchObject({ status: "BINDING_REVIEW" });
    const bad = invoice(fixture);
    bad.lines.data[0]!.period.end += 365 * 86400;
    expect(await send("invoice.paid", bad)).toMatchObject({
      status: "PAYMENT_REVIEW",
    });
    expect(
      await db.subscriptionInvoice.count({
        where: { tenantId: fixture.actor.tenantId },
      }),
    ).toBe(0);
    expect(
      (
        await db.tenant.findUniqueOrThrow({
          where: { id: fixture.actor.tenantId },
        })
      ).paidThrough,
    ).toBeNull();
  });
  it("keeps paid access after cancellation and ignores stale status and failed-payment events", async () => {
    const fixture = await enrollment(),
      paid = invoice(fixture),
      now = Math.floor(Date.now() / 1000);
    await send("invoice.paid", paid, now);
    const state = {
      id: fixture.subscriptionId,
      customer: fixture.customerId,
      metadata: fixture.metadata,
      status: "canceled",
      cancel_at_period_end: false,
    };
    await send("customer.subscription.deleted", state, now + 5);
    expect(
      await send(
        "customer.subscription.updated",
        { ...state, status: "active" },
        now + 1,
      ),
    ).toMatchObject({ status: "STALE_EVENT" });
    expect(await send("invoice.payment_failed", paid, now + 10)).toMatchObject({
      status: "STALE_EVENT",
    });
    const record = await db.recurringBilling.findUniqueOrThrow({
      where: { id: fixture.saved.id },
    });
    expect(record.status).toBe("CANCELED");
    expect(
      (
        await db.tenant.findUniqueOrThrow({
          where: { id: fixture.actor.tenantId },
        })
      ).paidThrough!.getTime(),
    ).toBe(paid.lines.data[0]!.period.end * 1000);
    const { prepareRecurringBilling } =
      await import("../apps/api/src/recurring-billing.js");
    await expect(
      prepareRecurringBilling(fixture.actor, fixture.plan.id, key()),
    ).rejects.toMatchObject({ code: "PAID_PERIOD_EXISTS" });
  });
  it("does not lift an operator suspension when a renewal is paid", async () => {
    const fixture = await enrollment();
    await db.tenant.update({
      where: { id: fixture.actor.tenantId },
      data: { subscriptionStatus: "SUSPENDED" },
    });
    await send("invoice.paid", invoice(fixture));
    expect(
      (
        await db.tenant.findUniqueOrThrow({
          where: { id: fixture.actor.tenantId },
        })
      ).subscriptionStatus,
    ).toBe("SUSPENDED");
    expect(
      (
        await db.subscriptionInvoice.findFirstOrThrow({
          where: { tenantId: fixture.actor.tenantId },
        })
      ).activationStatus,
    ).toBe("SUSPENDED_REVIEW");
  });
  it("limits subscription management to owners and fails honestly without a configured provider", async () => {
    await supertest(app)
      .get("/api/v1/billing/recurring")
      .set("Cookie", cashier.cookie)
      .expect(403);
    const result = await supertest(app)
      .get("/api/v1/billing/recurring")
      .set("Cookie", a.cookie)
      .expect(200);
    expect(result.body.configured).toBe(false);
    expect(JSON.stringify(result.body)).not.toContain("attemptKey");
    await supertest(app)
      .post("/api/v1/billing/recurring/checkout")
      .set("Cookie", a.cookie)
      .set("X-CSRF-Token", a.csrf)
      .set("Idempotency-Key", key())
      .send({ planId: planIds[0], consent: "monthly-renewal-v1" })
      .expect(503);
  });
  it("refuses uncertain provider submissions beyond the idempotency retry window", async () => {
    const fixture = await enrollment();
    const user = await db.user.create({
      data: {
        tenantId: fixture.actor.tenantId,
        name: "Retry fixture",
        email: `retry-${key()}@example.test`,
        passwordHash: await hashPassword("Retry-password-123"),
        role: "OWNER",
      },
    });
    userIds.push(user.id);
    const login = await supertest(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "Retry-password-123" })
      .expect(200);
    const cookie = login.headers["set-cookie"][0].split(";")[0];
    const old = Object.fromEntries(
      [
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "BILLING_PROVIDER_APPROVED",
      ].map((name) => [name, process.env[name]]),
    );
    try {
      // Only client construction is reached; stale requests must fail before any provider call.
      process.env.STRIPE_SECRET_KEY = "sk_test_fixture_only";
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture_only";
      process.env.BILLING_PROVIDER_APPROVED = "true";
      const requested = new Date(Date.now() - 24 * 3600000);
      await db.recurringBilling.update({
        where: { id: fixture.saved.id },
        data: { checkoutRequestedAt: requested },
      });
      const recurring = await supertest(app)
        .post("/api/v1/billing/recurring/checkout")
        .set("Cookie", cookie)
        .set("X-CSRF-Token", login.body.csrfToken)
        .set("Idempotency-Key", key())
        .send({ planId: fixture.plan.id, consent: "monthly-renewal-v1" })
        .expect(409);
      expect(recurring.body.error.code).toBe("SUBMISSION_REVIEW");
      const invoice = await db.subscriptionInvoice.create({
        data: {
          tenantId: fixture.actor.tenantId,
          planId: fixture.plan.id,
          planName: fixture.plan.name,
          number: `RETRY-${key()}`,
          amount: "120.00",
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 86400000),
          checkoutSessionId: "pending_fixture",
          checkoutRequestedAt: requested,
        },
      });
      const payment = await supertest(app)
        .post(`/api/v1/billing/${invoice.id}/checkout`)
        .set("Cookie", cookie)
        .set("X-CSRF-Token", login.body.csrfToken)
        .set("Idempotency-Key", key())
        .send({})
        .expect(409);
      expect(payment.body.error.code).toBe("SUBMISSION_REVIEW");
    } finally {
      for (const [name, value] of Object.entries(old)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
