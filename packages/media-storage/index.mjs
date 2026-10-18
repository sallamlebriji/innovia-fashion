import {
  mkdir,
  writeFile,
  readFile,
  unlink,
  readdir,
  lstat,
} from "node:fs/promises";
import { resolve, sep, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetBucketVersioningCommand,
} from "@aws-sdk/client-s3";

const maximumBytes = 10 * 1024 * 1024;
const maximumKeys = 100000;
const validKey = /^[a-f0-9-]{36}\.webp$/;
const defaultDirectory = fileURLToPath(
  new URL("../../.local/media", import.meta.url),
);
export class MediaStorageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MediaStorageError";
    this.code = code;
  }
}
function checkKey(key) {
  if (typeof key !== "string" || !validKey.test(key))
    throw new MediaStorageError(
      "INVALID_KEY",
      "Invalid stored media reference.",
    );
  return key;
}
function checkData(data) {
  if (!Buffer.isBuffer(data) || !data.length || data.length > maximumBytes)
    throw new MediaStorageError(
      "SIZE",
      "Stored media exceeds the supported size.",
    );
}
export function validateMediaStorage(env) {
  const driver = env.MEDIA_STORAGE || "local";
  if (!["local", "s3"].includes(driver))
    throw new MediaStorageError("CONFIG", "MEDIA_STORAGE must be local or s3.");
  if (driver === "local") {
    if (
      env.NODE_ENV === "production" &&
      (!env.MEDIA_DIR || !isAbsolute(env.MEDIA_DIR))
    )
      throw new MediaStorageError(
        "CONFIG",
        "MEDIA_DIR must identify a persistent absolute storage path.",
      );
    return;
  }
  if (
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(env.MEDIA_S3_BUCKET || "") ||
    /\.\.|^\d+\.\d+\.\d+\.\d+$/.test(env.MEDIA_S3_BUCKET || "")
  )
    throw new MediaStorageError(
      "CONFIG",
      "MEDIA_S3_BUCKET must identify a dedicated valid bucket.",
    );
  if (!/^[a-z0-9-]{1,64}$/.test(env.MEDIA_S3_REGION || ""))
    throw new MediaStorageError(
      "CONFIG",
      "MEDIA_S3_REGION is required for S3 storage.",
    );
  const prefix = env.MEDIA_S3_PREFIX || "innovia";
  if (
    prefix.length > 120 ||
    !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(prefix)
  )
    throw new MediaStorageError(
      "CONFIG",
      "MEDIA_S3_PREFIX must contain safe relative path segments.",
    );
  if (env.MEDIA_S3_ENDPOINT) {
    let endpoint;
    try {
      endpoint = new URL(env.MEDIA_S3_ENDPOINT);
    } catch {
      throw new MediaStorageError(
        "CONFIG",
        "MEDIA_S3_ENDPOINT must be a valid HTTPS origin.",
      );
    }
    if (
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.pathname !== "/" ||
      (endpoint.protocol !== "https:" &&
        !(
          env.NODE_ENV !== "production" &&
          endpoint.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
        ))
    )
      throw new MediaStorageError(
        "CONFIG",
        "MEDIA_S3_ENDPOINT must be HTTPS; only development loopback HTTP is supported.",
      );
  }
  if (
    env.MEDIA_S3_FORCE_PATH_STYLE &&
    !["true", "false"].includes(env.MEDIA_S3_FORCE_PATH_STYLE)
  )
    throw new MediaStorageError(
      "CONFIG",
      "MEDIA_S3_FORCE_PATH_STYLE must be true or false.",
    );
  if (
    !["AES256", "aws:kms", "provider"].includes(
      env.MEDIA_S3_ENCRYPTION || "AES256",
    )
  )
    throw new MediaStorageError(
      "CONFIG",
      "MEDIA_S3_ENCRYPTION must be AES256, aws:kms or provider.",
    );
  if (env.MEDIA_S3_ENCRYPTION === "aws:kms" && !env.MEDIA_S3_KMS_KEY_ID)
    throw new MediaStorageError(
      "CONFIG",
      "KMS encryption requires MEDIA_S3_KMS_KEY_ID.",
    );
  if (
    !!env.AWS_ACCESS_KEY_ID !== !!env.AWS_SECRET_ACCESS_KEY ||
    (!!env.AWS_SESSION_TOKEN && !env.AWS_ACCESS_KEY_ID)
  )
    throw new MediaStorageError(
      "CONFIG",
      "Supply complete AWS credentials or use an assigned IAM role.",
    );
}
function localStore(env) {
  const root = resolve(env.MEDIA_DIR || defaultDirectory);
  const path = (key) => {
    const result = resolve(root, checkKey(key));
    if (!result.startsWith(root + sep))
      throw new MediaStorageError("INVALID_KEY", "Invalid stored media path.");
    return result;
  };
  return {
    driver: "local",
    async put(key, data) {
      checkData(data);
      await mkdir(root, { recursive: true });
      await writeFile(path(key), data, { flag: "wx" });
    },
    async read(key) {
      const file = path(key),
        info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > maximumBytes)
        throw new MediaStorageError(
          "SIZE",
          "Stored media cannot be read safely.",
        );
      const data = await readFile(file);
      checkData(data);
      return data;
    },
    async remove(key) {
      try {
        await unlink(path(key));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    },
    async keys() {
      await mkdir(root, { recursive: true });
      const entries = await readdir(root, { withFileTypes: true });
      if (
        entries.length > maximumKeys ||
        entries.some((entry) => !entry.isFile() || !validKey.test(entry.name))
      )
        throw new MediaStorageError(
          "CONTENTS",
          "Media storage contains unexpected entries or exceeds the supported size.",
        );
      return entries.map((entry) => entry.name).sort();
    },
    close() {},
  };
}
function s3Store(env) {
  const prefix = (env.MEDIA_S3_PREFIX || "innovia") + "/",
    bucket = env.MEDIA_S3_BUCKET;
  const client = new S3Client({
    region: env.MEDIA_S3_REGION,
    endpoint: env.MEDIA_S3_ENDPOINT || undefined,
    forcePathStyle: env.MEDIA_S3_FORCE_PATH_STYLE === "true",
    // A retry can turn an uncertain successful PUT into 412. Send each
    // mutation once; the durable application ledger owns failure recovery.
    maxAttempts: 1,
    requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
    ...(env.AWS_ACCESS_KEY_ID
      ? {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            ...(env.AWS_SESSION_TOKEN
              ? { sessionToken: env.AWS_SESSION_TOKEN }
              : {}),
          },
        }
      : {}),
  });
  const send = async (command) => {
    try {
      return await client.send(command, {
        abortSignal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      const code =
        error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404
          ? "MISSING"
          : error.$metadata?.httpStatusCode === 412
            ? "CONFLICT"
            : "UNAVAILABLE";
      throw new MediaStorageError(
        code,
        code === "MISSING"
          ? "This media is unavailable."
          : code === "CONFLICT"
            ? "This media reference already exists."
            : "Media storage is temporarily unavailable.",
      );
    }
  };
  const objectKey = (key) => prefix + checkKey(key);
  // A delete marker is insufficient for private-photo retention. Check again
  // on every mutation so a provider configuration change fails closed.
  const requireUnversionedBucket = async () => {
    const result = await send(
      new GetBucketVersioningCommand({ Bucket: bucket }),
    );
    if (result.Status)
      throw new MediaStorageError(
        "CONFIG",
        "Media requires a dedicated bucket where versioning has never been enabled.",
      );
  };
  return {
    driver: "s3",
    async put(key, data) {
      checkData(data);
      objectKey(key);
      await requireUnversionedBucket();
      const encryption = env.MEDIA_S3_ENCRYPTION || "AES256";
      await send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey(key),
          Body: data,
          ContentLength: data.length,
          ContentType: "image/webp",
          IfNoneMatch: "*",
          Metadata: { sha256: createHash("sha256").update(data).digest("hex") },
          ...(encryption !== "provider"
            ? {
                ServerSideEncryption: encryption,
                ...(encryption === "aws:kms"
                  ? { SSEKMSKeyId: env.MEDIA_S3_KMS_KEY_ID }
                  : {}),
              }
            : {}),
        }),
      );
    },
    async read(key) {
      const response = await send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey(key) }),
      );
      const body = response.Body;
      const deadline = setTimeout(() => body?.destroy?.(), 20000);
      deadline.unref();
      try {
        if (
          !body ||
          !Number.isSafeInteger(response.ContentLength) ||
          response.ContentLength < 1 ||
          response.ContentLength > maximumBytes
        )
          throw new MediaStorageError(
            "SIZE",
            "Stored media exceeds the supported size.",
          );
        const chunks = [];
        let bytes = 0;
        for await (const chunk of body) {
          const buffer = Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > maximumBytes)
            throw new MediaStorageError(
              "SIZE",
              "Stored media exceeds the supported size.",
            );
          chunks.push(buffer);
        }
        const data = Buffer.concat(chunks);
        if (
          data.length !== response.ContentLength ||
          (response.Metadata?.sha256 &&
            response.Metadata.sha256 !==
              createHash("sha256").update(data).digest("hex"))
        )
          throw new MediaStorageError(
            "INTEGRITY",
            "Stored media failed integrity verification.",
          );
        return data;
      } catch (error) {
        if (error instanceof MediaStorageError) throw error;
        throw new MediaStorageError(
          "UNAVAILABLE",
          "Media storage is temporarily unavailable.",
        );
      } finally {
        clearTimeout(deadline);
        body?.destroy?.();
      }
    },
    async remove(key) {
      objectKey(key);
      await requireUnversionedBucket();
      try {
        await send(
          new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(key) }),
        );
      } catch (error) {
        if (error.code !== "MISSING") throw error;
      }
    },
    async keys() {
      const keys = new Set(),
        tokens = new Set();
      let continuation;
      do {
        const result = await send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuation,
            MaxKeys: 1000,
          }),
        );
        for (const object of result.Contents || []) {
          const name = object.Key?.slice(prefix.length);
          if (!object.Key?.startsWith(prefix) || !name || !validKey.test(name))
            throw new MediaStorageError(
              "CONTENTS",
              "Media storage contains unexpected entries.",
            );
          keys.add(name);
          if (keys.size > maximumKeys)
            throw new MediaStorageError(
              "CONTENTS",
              "Media storage exceeds the supported backup size.",
            );
        }
        continuation = result.IsTruncated
          ? result.NextContinuationToken
          : undefined;
        if (result.IsTruncated && (!continuation || tokens.has(continuation)))
          throw new MediaStorageError(
            "CONTENTS",
            "Media listing did not progress safely.",
          );
        if (continuation) tokens.add(continuation);
      } while (continuation);
      return [...keys].sort();
    },
    close() {
      client.destroy();
    },
  };
}
export function createMediaStore(env = process.env) {
  validateMediaStorage(env);
  return env.MEDIA_STORAGE === "s3" ? s3Store(env) : localStore(env);
}
const stores = new Map();
export function getMediaStore(env = process.env) {
  const configuration = JSON.stringify([
    env.NODE_ENV,
    env.MEDIA_STORAGE,
    env.MEDIA_DIR,
    env.MEDIA_S3_BUCKET,
    env.MEDIA_S3_REGION,
    env.MEDIA_S3_ENDPOINT,
    env.MEDIA_S3_PREFIX,
    env.MEDIA_S3_FORCE_PATH_STYLE,
    env.MEDIA_S3_ENCRYPTION,
    env.MEDIA_S3_KMS_KEY_ID,
    env.AWS_ACCESS_KEY_ID,
    env.AWS_SECRET_ACCESS_KEY,
    env.AWS_SESSION_TOKEN,
  ]);
  if (!stores.has(configuration))
    stores.set(configuration, createMediaStore(env));
  return stores.get(configuration);
}
export function closeMediaStorage() {
  for (const store of stores.values()) store.close();
  stores.clear();
}
