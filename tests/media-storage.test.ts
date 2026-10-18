import { it, expect } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep, basename } from "node:path";
import { tmpdir } from "node:os";
import { createMediaStore, validateMediaStorage } from "@innovia/media-storage";
import { backupMedia, unseal } from "../scripts/recovery.mjs";
import { s3Fixture } from "./helpers/s3";
const key = () => `${randomUUID()}.webp`;
async function clean(dir: string) {
  const absolute = resolve(dir);
  if (
    !absolute.startsWith(resolve(tmpdir()) + sep) ||
    !basename(absolute).startsWith("innovia-storage-test-")
  )
    throw new Error("Refusing unrelated fixture cleanup.");
  await rm(absolute, { recursive: true, force: true });
}
it("preserves local media bytes, refuses replacement/traversal, and removes missing objects idempotently", async () => {
  const dir = await mkdtemp(join(tmpdir(), "innovia-storage-test-")),
    store = createMediaStore({ MEDIA_DIR: dir }),
    name = key(),
    data = Buffer.from("fixture image bytes");
  try {
    await store.put(name, data);
    expect(await store.read(name)).toEqual(data);
    await expect(
      store.put(name, Buffer.from("replacement")),
    ).rejects.toMatchObject({ code: "EEXIST" });
    await expect(store.read("../escape.webp")).rejects.toThrow("reference");
    await expect(
      store.put(key(), Buffer.alloc(11 * 1024 * 1024)),
    ).rejects.toThrow("size");
    expect(await store.keys()).toEqual([name]);
    await store.remove(name);
    await store.remove(name);
    expect(await store.keys()).toEqual([]);
  } finally {
    store.close();
    await clean(dir);
  }
});
it("rejects unknown entries in a local media backup", async () => {
  const dir = await mkdtemp(join(tmpdir(), "innovia-storage-test-")),
    store = createMediaStore({ MEDIA_DIR: dir });
  try {
    await writeFile(join(dir, "unexpected.txt"), "unrelated");
    await expect(store.keys()).rejects.toThrow("unexpected");
  } finally {
    await clean(dir);
  }
});
it("uses signed, encrypted conditional S3 requests and paginates within the configured prefix", async () => {
  const fixture = await s3Fixture(),
    store = createMediaStore(fixture.env),
    name = key(),
    another = key(),
    data = Buffer.from("fixture image bytes");
  try {
    await store.put(name, data);
    await store.put(another, data);
    expect(await store.read(name)).toEqual(data);
    expect(await store.keys()).toEqual([name, another].sort());
    await expect(
      store.put(name, Buffer.from("replacement")),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await store.read(name)).toEqual(data);
    expect(
      fixture.requests
        .filter((req) => req.method === "PUT")
        .every(
          (req) =>
            req.conditional === "*" && req.encryption === "AES256" && !req.acl,
        ),
    ).toBe(true);
    expect(
      (await fetch(`${fixture.endpoint}/test-bucket/innovia/${name}`)).status,
    ).toBe(403);
    await store.remove(name);
    await store.remove(name);
    await expect(store.read(name)).rejects.toMatchObject({ code: "MISSING" });
    expect(fixture.failures).toEqual([]);
  } finally {
    store.close();
    await fixture.close();
  }
});
it("refuses corrupted, oversized or unsafe S3 object responses and repeated pagination tokens", async () => {
  const fixture = await s3Fixture(),
    store = createMediaStore(fixture.env),
    name = key();
  try {
    await store.put(name, Buffer.from("fixture image bytes"));
    fixture.state.corruptRead = true;
    await expect(store.read(name)).rejects.toMatchObject({ code: "INTEGRITY" });
    fixture.state.corruptRead = false;
    fixture.state.oversizedRead = true;
    await expect(store.read(name)).rejects.toMatchObject({ code: "SIZE" });
    await expect(store.read("../escape.webp")).rejects.toThrow("reference");
    fixture.state.repeatedPage = true;
    await expect(store.keys()).rejects.toThrow("progress");
  } finally {
    store.close();
    await fixture.close();
  }
});
it("validates cloud storage origins, credential pairs and safe bucket/prefix configuration", () => {
  const env = {
    MEDIA_STORAGE: "s3",
    MEDIA_S3_BUCKET: "example-media",
    MEDIA_S3_REGION: "eu-west-1",
  };
  expect(() =>
    validateMediaStorage({ ...env, NODE_ENV: "production" }),
  ).not.toThrow();
  expect(() =>
    validateMediaStorage({
      ...env,
      NODE_ENV: "production",
      MEDIA_S3_ENDPOINT: "http://127.0.0.1:9000",
    }),
  ).toThrow("HTTPS");
  expect(() =>
    validateMediaStorage({
      ...env,
      MEDIA_S3_ENDPOINT: "https://secret:password@storage.example.test",
    }),
  ).toThrow("HTTPS");
  expect(() =>
    validateMediaStorage({ ...env, MEDIA_S3_PREFIX: "../escape" }),
  ).toThrow("segments");
  expect(() =>
    validateMediaStorage({ ...env, AWS_ACCESS_KEY_ID: "incomplete" }),
  ).toThrow("complete");
  expect(() =>
    validateMediaStorage({ ...env, MEDIA_S3_ENCRYPTION: "aws:kms" }),
  ).toThrow("KMS");
  expect(() => validateMediaStorage({ ...env, MEDIA_STORAGE: "typo" })).toThrow(
    "local or s3",
  );
});
it("refuses writes and deletion markers when bucket versioning is enabled, suspended or cannot be verified", async () => {
  const fixture = await s3Fixture(),
    store = createMediaStore(fixture.env),
    name = key(),
    data = Buffer.from("private fixture bytes");
  try {
    await store.put(name, data);
    for (const status of ["Enabled", "Suspended"] as const) {
      fixture.state.versioning = status;
      await expect(store.put(key(), data)).rejects.toMatchObject({
        code: "CONFIG",
      });
      await expect(store.remove(name)).rejects.toMatchObject({
        code: "CONFIG",
      });
      expect(fixture.objects.has(`innovia/${name}`)).toBe(true);
    }
    fixture.state.versioning = "";
    fixture.state.failVersioning = true;
    await expect(store.put(key(), data)).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    await expect(store.remove(name)).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    fixture.state.failVersioning = false;
    await store.remove(name);
    expect(fixture.objects.size).toBe(0);
  } finally {
    store.close();
    await fixture.close();
  }
});
it("encrypts and verifies mixed local/cloud media without duplicating identical migration copies", async () => {
  const fixture = await s3Fixture(),
    dir = await mkdtemp(join(tmpdir(), "innovia-storage-test-")),
    local = join(dir, "local"),
    cloud = createMediaStore(fixture.env),
    store = createMediaStore({ MEDIA_DIR: local }),
    name = key(),
    cloudOnly = key(),
    data = Buffer.from("fixture image bytes"),
    secret = randomBytes(32);
  try {
    await mkdir(join(dir, "media"));
    await store.put(name, data);
    await cloud.put(name, data);
    await cloud.put(cloudOnly, data);
    const media = await backupMedia(
      dir,
      { ...fixture.env, MEDIA_DIR: local },
      secret,
    );
    expect(media).toHaveLength(2);
    for (const entry of media) {
      const sealed = join(dir, "media", entry.name + ".enc");
      expect((await readFile(sealed)).includes(data)).toBe(false);
      await unseal(sealed, join(dir, entry.name), secret, entry.sha256);
      expect(await readFile(join(dir, entry.name))).toEqual(data);
    }
    const publicOnly = join(dir, "public-only");
    await mkdir(join(publicOnly, "media"), { recursive: true });
    const safe = await backupMedia(
      publicOnly,
      { ...fixture.env, MEDIA_DIR: local },
      secret,
      new Set([name]),
    );
    expect(safe.map((entry: { name: string }) => entry.name)).toEqual([name]);
    const missing = join(dir, "missing");
    await mkdir(join(missing, "media"), { recursive: true });
    await expect(
      backupMedia(
        missing,
        { ...fixture.env, MEDIA_DIR: local },
        secret,
        new Set([key()]),
      ),
    ).rejects.toThrow("no readable storage copy");
    fixture.objects.get(`innovia/${name}`)!.data =
      Buffer.from("different bytes");
    const second = join(dir, "conflict");
    await mkdir(join(second, "media"), { recursive: true });
    // Update the fixture metadata so this checks conflicting copies independently of transport corruption.
    const { createHash } = await import("node:crypto");
    fixture.objects.get(`innovia/${name}`)!.hash = createHash("sha256")
      .update("different bytes")
      .digest("hex");
    await expect(
      backupMedia(second, { ...fixture.env, MEDIA_DIR: local }, secret),
    ).rejects.toThrow("conflicting");
  } finally {
    cloud.close();
    store.close();
    await fixture.close();
    await clean(dir);
  }
});
