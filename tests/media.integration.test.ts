import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import dotenv from "dotenv";
import supertest from "supertest";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep, basename } from "node:path";
import sharp from "sharp";
import { closeMediaStorage, createMediaStore } from "@innovia/media-storage";
import { s3Fixture } from "./helpers/s3";
dotenv.config({ quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Use a dedicated MySQL test database.");
process.env.DATABASE_URL = url;
process.env.NODE_ENV = "test";
const { db } = await import("../apps/api/src/db.js");
const observed: string[] = [];
let migrating = false;
const fixture = await s3Fixture(async (key) => {
  const asset = await db.mediaAsset.findUniqueOrThrow({
    where: { storageKey: key.split("/").at(-1)! },
  });
  expect(asset.storageStatus).toBe(migrating ? "READY" : "UPLOADING");
  if (migrating) expect(asset.visibility).toBe("PUBLIC");
  else expect(asset.uploadLeaseEndsAt! > new Date()).toBe(true);
  observed.push(asset.id);
});
const folder = await mkdtemp(join(tmpdir(), "innovia-storage-test-"));
const saved = new Map<string, string | undefined>();
for (const [key, value] of Object.entries({
  ...fixture.env,
  MEDIA_DIR: folder,
})) {
  saved.set(key, process.env[key]);
  process.env[key] = value;
}
const { createApp } = await import("../apps/api/src/app.js");
const { saveImage, readImage, purgeMedia } =
  await import("../apps/api/src/media.js");
const { hashPassword } = await import("../apps/api/src/auth.js");
const { MemoryStore } = await import("express-rate-limit");
const { migratePublicMediaToS3 } =
  await import("../apps/api/src/media-migration.js");
const limits = new MemoryStore(),
  app = createApp({ globalRateLimitStore: limits });
let tenantId: string,
  planId: string,
  userId: string,
  cookie: string,
  csrf: string;
let image: Buffer;
beforeAll(async () => {
  const suffix = randomUUID();
  const plan = await db.subscriptionPlan.create({
    data: {
      name: `Storage-${suffix}`,
      monthlyPrice: "100",
      productLimit: 10,
      storeLimit: 2,
    },
  });
  planId = plan.id;
  const tenant = await db.tenant.create({
    data: { name: "Storage fixture", slug: `storage-${suffix}`, planId },
  });
  tenantId = tenant.id;
  const user = await db.user.create({
    data: {
      tenantId,
      name: "Storage owner",
      email: `storage-${suffix}@example.test`,
      passwordHash: await hashPassword("Storage-password-123"),
      role: "OWNER",
    },
  });
  userId = user.id;
  const login = await supertest(app)
    .post("/api/v1/auth/login")
    .send({ email: user.email, password: "Storage-password-123" })
    .expect(200);
  cookie = login.headers["set-cookie"][0].split(";")[0];
  csrf = login.body.csrfToken;
  image = await sharp({
    create: { width: 48, height: 48, channels: 3, background: "#abcdef" },
  })
    .png()
    .toBuffer();
});
beforeEach(() => {
  limits.resetAll();
  fixture.state.failWrites = false;
  fixture.state.conflictWrites = false;
  fixture.state.failDeletes = false;
  process.env.MEDIA_STORAGE = "s3";
});
afterAll(async () => {
  closeMediaStorage();
  await fixture.close();
  if (tenantId) {
    const where = { tenantId };
    await db.session.deleteMany({ where: { userId } });
    await db.mediaAsset.deleteMany({ where });
    await db.customerSession.deleteMany({ where });
    await db.customerConsent.deleteMany({ where });
    await db.customer.deleteMany({ where });
    await db.auditLog.deleteMany({ where });
    await db.user.deleteMany({ where });
    await db.tenant.delete({ where: { id: tenantId } });
  }
  if (planId) await db.subscriptionPlan.delete({ where: { id: planId } });
  await db.$disconnect();
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const absolute = resolve(folder);
  if (
    !absolute.startsWith(resolve(tmpdir()) + sep) ||
    !basename(absolute).startsWith("innovia-storage-test-")
  )
    throw new Error("Refusing unrelated fixture cleanup.");
  await rm(absolute, { recursive: true, force: true });
});
const actor = () => ({ id: userId, tenantId, role: "OWNER" as const });
const upload = () =>
  supertest(app)
    .post("/api/v1/media")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", csrf)
    .set("Content-Type", "image/png")
    .send(image);
it("publishes confirmed cloud uploads through existing URLs and preserves legacy local reads", async () => {
  const response = await upload().expect(201),
    id = response.body.id;
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
  expect(asset.storageDriver).toBe("S3");
  expect(asset.storageStatus).toBe("READY");
  expect(asset.uploadLeaseEndsAt).toBeNull();
  expect(observed).toContain(id);
  expect(response.body.url).toBe(`/api/v1/media/${id}`);
  expect(JSON.stringify(response.body)).not.toContain("test-bucket");
  await supertest(app).get(response.body.url).expect(200);
  await expect(readImage("another-tenant", id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  process.env.MEDIA_STORAGE = "local";
  const old = await saveImage(actor(), image);
  await supertest(app).get(old.url!).expect(200);
  await supertest(app).get(response.body.url).expect(200);
  process.env.MEDIA_STORAGE = "s3";
  await supertest(app).get(old.url!).expect(200);
  expect(fixture.failures).toEqual([]);
});
it("requires photo consent, denies public/cross-customer reads and removes expired cloud photos", async () => {
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    path = `/api/v1/storefront/${tenant.slug}/customer`;
  async function customer() {
    const response = await supertest(app)
      .post(`${path}/register`)
      .send({
        name: "Storage customer",
        email: `customer-${randomUUID()}@example.test`,
        phone: "+212612345678",
        password: "Customer-password-123",
        termsAccepted: true,
      })
      .expect(201);
    return {
      cookie: response.headers["set-cookie"][0].split(";")[0],
      csrf: response.body.csrfToken,
    };
  }
  const person = await customer(),
    other = await customer();
  const photo = () =>
    supertest(app)
      .post(`${path}/media`)
      .set("Cookie", person.cookie)
      .set("X-CSRF-Token", person.csrf)
      .set("Content-Type", "image/png");
  await photo().send(image).expect(422);
  const response = await photo()
      .set("X-Photo-Consent", "self-photo-v1")
      .send(image)
      .expect(201),
    id = response.body.id;
  await supertest(app).get(`/api/v1/media/${id}`).expect(404);
  await supertest(app)
    .get(`${path}/media/${id}`)
    .set("Cookie", other.cookie)
    .expect(404);
  const allowed = await supertest(app)
    .get(`${path}/media/${id}`)
    .set("Cookie", person.cookie)
    .expect(200);
  expect(allowed.headers["cache-control"]).toBe("no-store");
  const asset = await db.mediaAsset.update({
    where: { id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await purgeMedia();
  expect(fixture.objects.has(`innovia/${asset.storageKey}`)).toBe(false);
  expect((await db.mediaAsset.findUniqueOrThrow({ where: { id } })).bytes).toBe(
    0,
  );
});
it("keeps failed or uncertain writes hidden and persists cleanup retries during provider failure", async () => {
  fixture.state.failWrites = true;
  fixture.state.failDeletes = true;
  await upload().expect(503);
  const asset = await db.mediaAsset.findFirstOrThrow({
    where: { tenantId, storageStatus: "FAILED" },
    orderBy: { createdAt: "desc" },
  });
  expect(asset.deletedAt).not.toBeNull();
  expect(asset.bytes).toBeGreaterThan(0);
  expect(fixture.objects.has(`innovia/${asset.storageKey}`)).toBe(true);
  await supertest(app).get(`/api/v1/media/${asset.id}`).expect(404);
  await purgeMedia();
  expect(
    (await db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } })).bytes,
  ).toBeGreaterThan(0);
  fixture.state.failDeletes = false;
  await purgeMedia();
  expect(
    (await db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } })).bytes,
  ).toBe(0);
  expect(fixture.objects.has(`innovia/${asset.storageKey}`)).toBe(false);
});
it("does not delete or claim an existing object when a conditional upload is rejected", async () => {
  fixture.state.conflictWrites = true;
  await upload().expect(503);
  const rejected = await db.mediaAsset.findFirstOrThrow({
    where: { tenantId, storageStatus: "FAILED" },
    orderBy: { createdAt: "desc" },
  });
  expect(rejected.bytes).toBe(0);
  const key = `innovia/${rejected.storageKey}`;
  expect(fixture.objects.get(key)!.data.toString()).toBe("pre-existing image");
  await purgeMedia();
  expect(fixture.objects.get(key)!.data.toString()).toBe("pre-existing image");
  expect(
    fixture.requests.some(
      (req) =>
        req.method === "DELETE" && req.path.endsWith(rejected.storageKey),
    ),
  ).toBe(false);
  await supertest(app).get(`/api/v1/media/${rejected.id}`).expect(404);
});
it("cleans crash-interrupted uploads after lease expiry without publishing them", async () => {
  const storageKey = `${randomUUID()}.webp`,
    asset = await db.mediaAsset.create({
      data: {
        tenantId,
        name: "Interrupted upload",
        storageKey,
        storageDriver: "S3",
        storageStatus: "UPLOADING",
        uploadLeaseEndsAt: new Date(Date.now() + 60000),
        mimeType: "image/webp",
        bytes: 20,
      },
    }),
    store = createMediaStore(fixture.env);
  try {
    await store.put(storageKey, Buffer.from("interrupted fixture bytes"));
  } finally {
    store.close();
  }
  await supertest(app).get(`/api/v1/media/${asset.id}`).expect(404);
  const list = await supertest(app)
    .get("/api/v1/media")
    .set("Cookie", cookie)
    .expect(200);
  expect(list.body.items.map((item: { id: string }) => item.id)).not.toContain(
    asset.id,
  );
  await db.mediaAsset.update({
    where: { id: asset.id },
    data: { uploadLeaseEndsAt: new Date(Date.now() - 1000) },
  });
  await purgeMedia();
  const removed = await db.mediaAsset.findUniqueOrThrow({
    where: { id: asset.id },
  });
  expect(removed.storageStatus).toBe("FAILED");
  expect(removed.bytes).toBe(0);
  expect(fixture.objects.has(`innovia/${storageKey}`)).toBe(false);
});
it("migrates public local assets after byte verification, adopts identical retry copies and retains private/local sources", async () => {
  process.env.MEDIA_STORAGE = "local";
  const first = await saveImage(actor(), image),
    second = await saveImage(actor(), image);
  const person = await db.customer.create({
    data: {
      tenantId,
      name: "Migration customer",
      email: `migration-${randomUUID()}@example.test`,
    },
  });
  const privatePhoto = await saveImage(actor(), image, person.id);
  const originalExpiry = privatePhoto.expiresAt;
  const retry = await db.mediaAsset.findUniqueOrThrow({
    where: { id: second.id },
  });
  const local = createMediaStore({ MEDIA_DIR: folder }),
    cloud = createMediaStore(fixture.env);
  migrating = true;
  try {
    await cloud.put(retry.storageKey, await local.read(retry.storageKey));
    process.env.MEDIA_STORAGE = "s3";
    const child = spawn(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/migrate-media-storage.mts",
        "--maintenance-confirmed",
        "--tenant",
        tenantId,
      ],
      {
        env: process.env,
        windowsHide: true,
      },
    );
    let output = "",
      failure = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      failure += chunk;
    });
    const code = await new Promise<number | null>((accept, reject) => {
      child.once("error", reject);
      child.once("close", accept);
    });
    expect(code, failure).toBe(0);
    const result = JSON.parse(output.trim());
    expect(result.migrated).toBeGreaterThanOrEqual(2);
    expect(result.sourceFilesRetained).toBe(true);
    for (const id of [first.id, second.id]) {
      const row = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
      expect(row.storageDriver).toBe("S3");
      expect(await local.read(row.storageKey)).toEqual(
        await cloud.read(row.storageKey),
      );
      await supertest(app).get(`/api/v1/media/${id}`).expect(200);
      expect(
        await db.auditLog.count({
          where: { tenantId, entityId: id, action: "MEDIA_STORAGE_MIGRATED" },
        }),
      ).toBe(1);
    }
    const retained = await db.mediaAsset.findUniqueOrThrow({
      where: { id: privatePhoto.id },
    });
    expect(retained.storageDriver).toBe("LOCAL");
    expect(retained.expiresAt).toEqual(originalExpiry);
    expect(fixture.objects.has(`innovia/${retained.storageKey}`)).toBe(false);
    expect((await migratePublicMediaToS3(process.env, tenantId)).migrated).toBe(
      0,
    );
    expect(fixture.failures).toEqual([]);
  } finally {
    migrating = false;
    local.close();
    cloud.close();
  }
});
it("refuses cloud migration when an existing object conflicts, preserving the authoritative local record", async () => {
  process.env.MEDIA_STORAGE = "local";
  const uploaded = await saveImage(actor(), image);
  const asset = await db.mediaAsset.findUniqueOrThrow({
    where: { id: uploaded.id },
  });
  const cloud = createMediaStore(fixture.env),
    local = createMediaStore({ MEDIA_DIR: folder });
  migrating = true;
  try {
    await cloud.put(asset.storageKey, Buffer.from("conflicting cloud object"));
    process.env.MEDIA_STORAGE = "s3";
    await expect(
      migratePublicMediaToS3(process.env, tenantId),
    ).rejects.toMatchObject({ code: "INTEGRITY" });
    expect(
      (await db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } }))
        .storageDriver,
    ).toBe("LOCAL");
    expect((await local.read(asset.storageKey)).length).toBe(asset.bytes);
    expect(await cloud.read(asset.storageKey)).toEqual(
      Buffer.from("conflicting cloud object"),
    );
    await supertest(app).get(`/api/v1/media/${asset.id}`).expect(200);
  } finally {
    migrating = false;
    local.close();
    cloud.close();
  }
});
it("advances cleanup past a failed cloud batch so newly expired local photos can still be removed", async () => {
  const data = Buffer.from("cleanup fixture bytes");
  const keys = Array.from({ length: 25 }, () => `${randomUUID()}.webp`);
  await db.mediaAsset.createMany({
    data: keys.map((storageKey) => ({
      tenantId,
      name: "Failed cleanup fixture",
      storageKey,
      storageDriver: "S3",
      storageStatus: "FAILED",
      deletedAt: new Date(),
      bytes: data.length,
      mimeType: "image/webp",
    })),
  });
  for (const key of keys)
    fixture.objects.set(`innovia/${key}`, { data, hash: "" });
  const storageKey = `${randomUUID()}.webp`,
    local = createMediaStore({ MEDIA_DIR: folder });
  await local.put(storageKey, data);
  const expired = await db.mediaAsset.create({
    data: {
      tenantId,
      name: "Expired local photo",
      storageKey,
      storageDriver: "LOCAL",
      visibility: "PRIVATE",
      expiresAt: new Date(Date.now() - 1000),
      bytes: data.length,
      mimeType: "image/webp",
    },
  });
  fixture.state.failDeletes = true;
  try {
    const first = await purgeMedia();
    expect(first.failed).toBe(25);
    expect(await local.read(storageKey)).toEqual(data);
    const next = await purgeMedia();
    expect(next.removed).toBeGreaterThanOrEqual(1);
    expect(
      (await db.mediaAsset.findUniqueOrThrow({ where: { id: expired.id } }))
        .bytes,
    ).toBe(0);
    await expect(local.read(storageKey)).rejects.toMatchObject({
      code: "ENOENT",
    });
  } finally {
    fixture.state.failDeletes = false;
    local.close();
    await purgeMedia();
  }
}, 60000);
