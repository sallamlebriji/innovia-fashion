import dotenv from "dotenv";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { createMediaStore } from "@innovia/media-storage";
import { s3Fixture } from "../tests/helpers/s3.ts";

dotenv.config({ quiet: true });
if (process.platform !== "win32" || process.env.NODE_ENV === "production")
  throw new Error(
    "Run this drill only against the project-local Windows MySQL instance.",
  );
const mysql = "C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe";
const defaults = `--defaults-file=${resolve(".local/mysql-root.cnf")}`;
function sql(statement) {
  const result = spawnSync(
    mysql,
    [defaults, "--batch", "--raw", "--skip-column-names"],
    { input: statement, encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error("The isolated recovery drill's MySQL command failed.");
  return result.stdout.trim();
}
if (
  resolve(sql("SELECT @@datadir"))
    .replace(/[\\/]+$/, "")
    .toLowerCase() !== resolve(".local/mysql-data").toLowerCase()
)
  throw new Error(
    "Refusing a recovery drill outside the project's local MySQL data directory.",
  );
const base = new URL(process.env.TEST_DATABASE_URL);
if (
  base.hostname !== "127.0.0.1" ||
  base.port !== "3308" ||
  base.username !== "innovia" ||
  !base.pathname.endsWith("_test")
)
  throw new Error("Expected the project's isolated MySQL test connection.");
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const source = `innovia_drill_${suffix}_test`,
  target = `innovia_drill_${suffix}_restore_test`;
function removeDrillDatabase(name) {
  if (!/^innovia_drill_[a-f0-9]{12}_(?:restore_)?test$/.test(name))
    throw new Error("Refusing unexpected database cleanup.");
  sql(
    `DROP DATABASE \`${name}\`; REVOKE ALL ON \`${name}\`.* FROM 'innovia'@'127.0.0.1';`,
  );
}
const parent = resolve(".local/recovery-drills"),
  workspace = join(parent, suffix);
async function removeDrillFiles() {
  const absolute = resolve(workspace);
  if (
    absolute !== join(parent, suffix) ||
    !absolute.startsWith(parent + sep) ||
    !/^[a-f0-9]{12}$/.test(suffix)
  )
    throw new Error(
      "Refusing recovery drill file cleanup outside the task directory.",
    );
  await rm(absolute, { recursive: true, force: true });
}
const media = join(workspace, "media"),
  restoredMedia = join(workspace, "media_restore_test");
const sourceUrl = new URL(base);
sourceUrl.pathname = `/${source}`;
const targetUrl = new URL(base);
targetUrl.pathname = `/${target}`;
await mkdir(media, { recursive: true });
for (const name of [source, target])
  sql(
    `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON \`${name}\`.* TO 'innovia'@'127.0.0.1';`,
  );
let sourceDb, restoredDb, fixture, cloud;
try {
  console.log(
    "Recovery drill: applying all migrations to a new isolated source.",
  );
  const migrated = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      env: { ...process.env, DATABASE_URL: sourceUrl.toString() },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  if (migrated.status !== 0)
    throw new Error("Could not prepare the isolated source database.");
  process.env.DATABASE_URL = sourceUrl.toString();
  process.env.MEDIA_DIR = media;
  sourceDb = new PrismaClient({
    datasources: { db: { url: sourceUrl.toString() } },
  });
  const plan = await sourceDb.subscriptionPlan.create({
    data: {
      name: "Recovery drill",
      monthlyPrice: "100.00",
      productLimit: 20,
      storeLimit: 2,
    },
  });
  const tenant = await sourceDb.tenant.create({
    data: {
      name: "Recovery boutique",
      slug: `drill-${suffix}`,
      planId: plan.id,
    },
  });
  const store = await sourceDb.store.create({
    data: { tenantId: tenant.id, name: "Drill store", city: "Casablanca" },
  });
  const actor = { tenantId: tenant.id, id: "recovery-drill", role: "OWNER" };
  const { createProduct, checkout } = await import("../apps/api/src/retail.ts");
  const product = await createProduct(
    actor,
    {
      name: "Drill linen shirt",
      description: "Isolated recovery fixture",
      category: "Shirts",
      brand: "Drill",
      collection: "Recovery",
      status: "ACTIVE",
      imageUrl: "",
      storeId: store.id,
      variants: [
        {
          sku: `DRILL-${suffix}`,
          size: "M",
          color: "Ivory",
          price: "120.00",
          cost: "45.00",
          quantity: 5,
          reorderPoint: 2,
        },
      ],
    },
    randomUUID(),
  );
  const sale = await checkout(
    actor,
    {
      storeId: store.id,
      customerName: "Recovery customer",
      channel: "POS",
      paymentMethod: "CASH",
      items: [{ variantId: product.variants[0].id, quantity: 2 }],
    },
    randomUUID(),
  );
  const imageName = `${randomUUID()}.webp`;
  const photo = await sharp({
    create: { width: 48, height: 48, channels: 3, background: "#e7ded1" },
  })
    .webp()
    .toBuffer();
  await writeFile(join(media, imageName), photo);
  const localAsset = await sourceDb.mediaAsset.create({
    data: {
      tenantId: tenant.id,
      name: "Local recovery image",
      storageKey: imageName,
      mimeType: "image/webp",
      bytes: photo.length,
    },
  });
  fixture = await s3Fixture();
  cloud = createMediaStore(fixture.env);
  const cloudAssets = [];
  for (const kind of ["public", "private", "interrupted"]) {
    const storageKey = `${randomUUID()}.webp`;
    const asset = await sourceDb.mediaAsset.create({
      data: {
        tenantId: tenant.id,
        name: `Cloud ${kind} recovery image`,
        storageKey,
        storageDriver: "S3",
        mimeType: "image/webp",
        bytes: photo.length,
        visibility: kind === "private" ? "PRIVATE" : "PUBLIC",
        expiresAt: kind === "private" ? new Date(Date.now() + 86400000) : null,
        storageStatus: kind === "interrupted" ? "UPLOADING" : "READY",
        uploadLeaseEndsAt:
          kind === "interrupted" ? new Date(Date.now() + 120000) : null,
      },
    });
    await cloud.put(storageKey, photo);
    cloudAssets.push(asset);
  }
  const env = {
    ...process.env,
    ...fixture.env,
    DATABASE_URL: sourceUrl.toString(),
    MEDIA_DIR: media,
    BACKUP_DIR: join(workspace, "backups"),
    BACKUP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    RESTORE_DATABASE_URL: targetUrl.toString(),
    RESTORE_MEDIA_DIR: restoredMedia,
    MYSQLCLIENT_PATH: mysql,
    MYSQLDUMP_PATH: "C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqldump.exe",
  };
  async function runRecovery(args, overrides = {}) {
    const child = spawn(process.execPath, ["scripts/recovery.mjs", ...args], {
      env: { ...env, ...overrides },
      windowsHide: true,
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const status = await new Promise((accept, reject) => {
      child.once("error", reject);
      child.once("close", accept);
    });
    return { status, stdout, stderr };
  }
  async function recovery(args) {
    const result = await runRecovery(args);
    if (result.status !== 0)
      throw new Error(result.stderr.trim() || "Recovery drill failed.");
    return JSON.parse(result.stdout.trim());
  }
  // No application process or worker uses this newly-created source database.
  console.log(
    "Recovery drill: encrypting a mixed local/S3 snapshot, excluding private and interrupted images.",
  );
  const snapshot = await recovery(["backup", "--maintenance-confirmed"]);
  assert.equal(snapshot.mediaFiles, 2);
  assert.equal((await recovery(["verify", snapshot.folder])).verified, true);
  console.log("Recovery drill: restoring into an empty isolated target.");
  assert.equal((await recovery(["restore", snapshot.folder])).restored, true);
  restoredDb = new PrismaClient({
    datasources: { db: { url: targetUrl.toString() } },
  });
  const recovered = await restoredDb.order.findUniqueOrThrow({
    where: { id: sale.id },
    include: { items: true },
  });
  assert.equal(recovered.total.toFixed(2), "240.00");
  assert.equal(recovered.items[0].quantity, 2);
  assert.equal(
    (
      await restoredDb.inventory.findFirstOrThrow({
        where: { tenantId: tenant.id },
      })
    ).onHand,
    3,
  );
  assert.equal(
    await restoredDb.stockMovement.count({ where: { tenantId: tenant.id } }),
    2,
  );
  assert.equal(
    (await restoredDb.auditLog.count({ where: { tenantId: tenant.id } })) > 0,
    true,
  );
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  assert.equal(
    hash(await readFile(join(restoredMedia, imageName))),
    hash(photo),
  );
  const restored = await restoredDb.mediaAsset.findMany({
    where: { tenantId: tenant.id },
  });
  assert.equal(restored.length, 4);
  assert.ok(
    restored.every(
      (asset) =>
        asset.storageDriver === "LOCAL" && asset.uploadLeaseEndsAt === null,
    ),
  );
  for (const original of [localAsset, cloudAssets[0]]) {
    assert.equal(
      restored.find((asset) => asset.id === original.id).storageStatus,
      "READY",
    );
    assert.equal(
      hash(await readFile(join(restoredMedia, original.storageKey))),
      hash(photo),
    );
  }
  for (const original of cloudAssets.slice(1)) {
    const rebound = restored.find((asset) => asset.id === original.id);
    assert.equal(rebound.storageStatus, "FAILED");
    assert.ok(rebound.deletedAt);
    await assert.rejects(readFile(join(restoredMedia, original.storageKey)), {
      code: "ENOENT",
    });
  }
  assert.equal(
    restored.find((asset) => asset.id === cloudAssets[1].id).bytes,
    0,
  );
  assert.equal(fixture.objects.size, 3);
  assert.equal(
    fixture.requests.some((request) => request.method === "DELETE"),
    false,
  );
  assert.deepEqual(fixture.failures, []);
  const refused = await runRecovery(["restore", snapshot.folder], {
    RESTORE_MEDIA_DIR: join(workspace, "another_restore_test"),
  });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /database must be empty/);
  console.log(
    "Encrypted recovery drill passed: 17 migrations, retail sale, stock, audits, local/S3 public media restored locally; private/interrupted images excluded and hidden; source cloud untouched; nonempty restore refused.",
  );
} finally {
  cloud?.close();
  await fixture?.close();
  await sourceDb?.$disconnect();
  await restoredDb?.$disconnect();
  const { db } = await import("../apps/api/src/db.ts");
  await db.$disconnect();
  for (const name of [source, target]) removeDrillDatabase(name);
  await removeDrillFiles();
}
