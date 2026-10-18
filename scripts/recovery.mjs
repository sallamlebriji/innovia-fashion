import dotenv from "dotenv";
import { createReadStream, createWriteStream } from "node:fs";
import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  stat,
  open,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { Transform, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { createMediaStore } from "@innovia/media-storage";
const root = fileURLToPath(new URL("..", import.meta.url));
const magic = Buffer.from("INNOVIA1\n");
export function encryptionKey(value) {
  const key = Buffer.from(value ?? "", "base64");
  if (key.length !== 32)
    throw new Error(
      "BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key stored separately from the backup.",
    );
  return key;
}
export function databaseTarget(value, restore = false) {
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    url.protocol !== "mysql:" ||
    !url.hostname ||
    !/^[A-Za-z0-9_]{1,64}$/.test(database)
  )
    throw new Error("Configure a valid MySQL database target.");
  if (restore && !database.endsWith("_restore_test"))
    throw new Error(
      "Restore is restricted to an empty isolated database ending in _restore_test.",
    );
  return {
    database,
    args: [
      "--host=" + url.hostname,
      "--port=" + (url.port || "3306"),
      "--user=" + decodeURIComponent(url.username),
      ...(url.searchParams.get("sslaccept") === "strict"
        ? ["--ssl-mode=VERIFY_IDENTITY"]
        : process.env.NODE_ENV === "production"
          ? ["--ssl-mode=REQUIRED"]
          : []),
    ],
    password: decodeURIComponent(url.password),
  };
}
export async function seal(input, target, key) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv),
    hash = createHash("sha256");
  const tap = new Transform({
    transform(chunk, _encoding, next) {
      hash.update(chunk);
      next(null, chunk);
    },
  });
  const output = createWriteStream(target, { flags: "wx", mode: 0o600 });
  output.write(Buffer.concat([magic, iv]));
  await pipeline(input, tap, cipher, output);
  await appendFile(target, cipher.getAuthTag());
  return hash.digest("hex");
}
export async function unseal(source, target, key, expectedHash) {
  const size = (await stat(source)).size;
  if (size < magic.length + 28) throw new Error("Incomplete encrypted backup.");
  const handle = await open(source, "r");
  const header = Buffer.alloc(magic.length + 12),
    tag = Buffer.alloc(16);
  try {
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, tag.length, size - 16);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, magic.length).equals(magic))
    throw new Error("Unknown backup format.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    header.subarray(magic.length),
  );
  decipher.setAuthTag(tag);
  const hash = createHash("sha256"),
    tap = new Transform({
      transform(chunk, _encoding, next) {
        hash.update(chunk);
        next(null, chunk);
      },
    });
  await pipeline(
    createReadStream(source, { start: header.length, end: size - 17 }),
    decipher,
    tap,
    createWriteStream(target, { flags: "wx", mode: 0o600 }),
  );
  if (expectedHash && hash.digest("hex") !== expectedHash)
    throw new Error("Backup checksum mismatch.");
}
function client(name, target, args) {
  const exe =
    process.env[name === "mysqldump" ? "MYSQLDUMP_PATH" : "MYSQLCLIENT_PATH"] ||
    name;
  const child = spawn(exe, ["--no-defaults", ...target.args, ...args], {
    windowsHide: true,
    env: { ...process.env, MYSQL_PWD: target.password },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  const done = new Promise((accept, reject) => {
    child.on("error", () =>
      reject(
        new Error(
          "MySQL client could not start. Configure its executable path.",
        ),
      ),
    );
    child.on("close", (code) =>
      code === 0
        ? accept()
        : reject(
            new Error(
              `MySQL client failed with exit code ${code}; credentials were not logged.`,
            ),
          ),
    );
  });
  // Attach immediately so an early client error never becomes an unhandled rejection.
  done.catch(() => {});
  return { child, done };
}
async function query(target, sql) {
  const request = client("mysql", target, [
    "--batch",
    "--raw",
    "--skip-column-names",
    target.database,
    "--execute=" + sql,
  ]);
  let output = "";
  request.child.stdin.end();
  request.child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  await request.done;
  return output.trim();
}
async function removeRestoreStage(stage, backupDir) {
  const verified = resolve(stage);
  if (
    !verified.startsWith(backupDir + sep) ||
    !verified.split(sep).at(-1).startsWith("restore-")
  )
    throw new Error(
      "Refusing temporary-file cleanup outside the backup directory.",
    );
  await rm(verified, { recursive: true, force: true });
}
export async function backupMedia(folder, env, key, allowedKeys) {
  const stores = [],
    media = new Map();
  try {
    if (env.MEDIA_STORAGE !== "s3" || env.MEDIA_DIR)
      stores.push(createMediaStore({ ...env, MEDIA_STORAGE: "local" }));
    if (env.MEDIA_STORAGE === "s3" || env.MEDIA_S3_BUCKET)
      stores.push(createMediaStore({ ...env, MEDIA_STORAGE: "s3" }));
    for (const store of stores) {
      for (const name of await store.keys()) {
        if (allowedKeys && !allowedKeys.has(name)) continue;
        const data = await store.read(name),
          hash = createHash("sha256").update(data).digest("hex");
        const previous = media.get(name);
        if (previous) {
          if (previous.sha256 !== hash)
            throw new Error(
              "The same media reference has conflicting storage copies; backup left incomplete.",
            );
          continue;
        }
        media.set(name, {
          name,
          sha256: await seal(
            Readable.from([data]),
            join(folder, "media", name + ".enc"),
            key,
          ),
        });
      }
    }
    if (allowedKeys && [...allowedKeys].some((name) => !media.has(name)))
      throw new Error(
        "A public media record has no readable storage copy; backup left incomplete.",
      );
    return [...media.values()];
  } finally {
    for (const store of stores) store.close();
  }
}
export async function backup(env = process.env) {
  if (!process.argv.includes("--maintenance-confirmed"))
    throw new Error(
      "Stop application writes and workers first, then pass --maintenance-confirmed for a consistent database/media snapshot.",
    );
  const key = encryptionKey(env.BACKUP_ENCRYPTION_KEY),
    target = databaseTarget(env.DATABASE_URL);
  const folder = join(
    resolve(env.BACKUP_DIR || join(root, ".local/backups")),
    new Date().toISOString().replaceAll(":", "-") + "-" + randomUUID(),
  );
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await mkdir(join(folder, "media"), { mode: 0o700 });
  const { child, done } = client("mysqldump", target, [
    "--single-transaction",
    "--quick",
    "--routines",
    "--triggers",
    "--events",
    "--hex-blob",
    "--set-gtid-purged=OFF",
    "--no-tablespaces",
    "--default-character-set=utf8mb4",
    target.database,
  ]);
  child.stdin.end();
  const sqlHash = await seal(
    child.stdout,
    join(folder, "database.sql.enc"),
    key,
  );
  await done;
  // Never copy temporary fitting photos into a longer-lived backup. The
  // maintenance window keeps this ledger query consistent with the SQL dump.
  const columns = await query(
    target,
    `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = '${target.database}' AND LOWER(table_name) = 'mediaasset' AND column_name = 'storageStatus'`,
  );
  const publicKeys = await query(
    target,
    "SELECT storageKey FROM MediaAsset WHERE visibility = 'PUBLIC' AND deletedAt IS NULL" +
      (columns === "1" ? " AND storageStatus = 'READY'" : ""),
  );
  const media = await backupMedia(
    folder,
    env,
    key,
    new Set(publicKeys ? publicKeys.split(/\r?\n/) : []),
  );
  await seal(
    Readable.from([
      JSON.stringify({
        version: 1,
        createdAt: new Date().toISOString(),
        sourceDatabase: target.database,
        sqlHash,
        media,
      }),
    ]),
    join(folder, "manifest.json.enc"),
    key,
  );
  return { folder, mediaFiles: media.length };
}
export async function restore(folder, verifyOnly = false, env = process.env) {
  const backupDir = resolve(folder),
    key = encryptionKey(env.BACKUP_ENCRYPTION_KEY),
    stage = await mkdtemp(join(backupDir, "restore-"));
  try {
    await unseal(
      join(backupDir, "manifest.json.enc"),
      join(stage, "manifest.json"),
      key,
    );
    if ((await stat(join(stage, "manifest.json"))).size > 10 * 1024 * 1024)
      throw new Error("Backup manifest exceeds the supported size.");
    const manifest = JSON.parse(
      await readFile(join(stage, "manifest.json"), "utf8"),
    );
    if (
      manifest.version !== 1 ||
      !Array.isArray(manifest.media) ||
      !/^[a-f0-9]{64}$/.test(manifest.sqlHash)
    )
      throw new Error("Invalid backup manifest.");
    await unseal(
      join(backupDir, "database.sql.enc"),
      join(stage, "database.sql"),
      key,
      manifest.sqlHash,
    );
    await mkdir(join(stage, "media"));
    const names = new Set();
    for (const entry of manifest.media) {
      if (
        !/^[a-f0-9-]{36}\.webp$/.test(entry.name) ||
        !/^[a-f0-9]{64}$/.test(entry.sha256) ||
        names.has(entry.name)
      )
        throw new Error("Invalid media entry in backup.");
      names.add(entry.name);
      await unseal(
        join(backupDir, "media", entry.name + ".enc"),
        join(stage, "media", entry.name),
        key,
        entry.sha256,
      );
    }
    if (verifyOnly) return { verified: true, mediaFiles: names.size };
    const target = databaseTarget(env.RESTORE_DATABASE_URL, true),
      media = resolve(env.RESTORE_MEDIA_DIR || "");
    if (
      !env.RESTORE_MEDIA_DIR ||
      !media.endsWith("_restore_test") ||
      media === resolve(env.MEDIA_DIR || join(root, ".local/media"))
    )
      throw new Error(
        "RESTORE_MEDIA_DIR must be a separate empty directory ending in _restore_test.",
      );
    await mkdir(media, { recursive: true, mode: 0o700 });
    if ((await readdir(media)).length)
      throw new Error("Restore media destination must be empty.");
    const check = client("mysql", target, [
      "--batch",
      "--skip-column-names",
      target.database,
      "--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '" +
        target.database +
        "'",
    ]);
    let tables = "";
    check.child.stdin.end();
    check.child.stdout.on("data", (chunk) => {
      tables += chunk;
    });
    await check.done;
    if (tables.trim() !== "0")
      throw new Error(
        "Restore database must be empty; existing records are never dropped or overwritten.",
      );
    const load = client("mysql", target, [
      "--default-character-set=utf8mb4",
      target.database,
    ]);
    load.child.stdout.resume();
    await pipeline(
      createReadStream(join(stage, "database.sql")),
      load.child.stdin,
    );
    await load.done;
    // Recovery is isolated and local: restored S3 references must never point
    // at, or allow cleanup to delete from, the source provider bucket.
    const legacy = client("mysql", target, [
      "--batch",
      "--skip-column-names",
      target.database,
      `--execute=SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = '${target.database}' AND LOWER(table_name) = 'mediaasset' AND column_name = 'storageDriver'`,
    ]);
    let storageColumns = "";
    legacy.child.stdin.end();
    legacy.child.stdout.on("data", (chunk) => {
      storageColumns += chunk;
    });
    await legacy.done;
    if (storageColumns.trim() === "1") {
      const rebind = client("mysql", target, [
        target.database,
        "--execute=UPDATE MediaAsset SET deletedAt = CASE WHEN visibility = 'PRIVATE' OR storageStatus = 'UPLOADING' THEN COALESCE(deletedAt, CURRENT_TIMESTAMP(3)) ELSE deletedAt END, bytes = CASE WHEN visibility = 'PRIVATE' THEN 0 ELSE bytes END, storageStatus = CASE WHEN visibility = 'PRIVATE' OR storageStatus = 'UPLOADING' THEN 'FAILED' ELSE storageStatus END, uploadLeaseEndsAt = NULL, storageDriver = 'LOCAL'",
      ]);
      rebind.child.stdin.end();
      rebind.child.stdout.resume();
      await rebind.done;
    }
    for (const name of names) {
      const { copyFile, constants } = await import("node:fs/promises");
      await copyFile(
        join(stage, "media", name),
        join(media, name),
        constants.COPYFILE_EXCL,
      );
    }
    return {
      restored: true,
      database: target.database,
      mediaFiles: names.size,
    };
  } finally {
    await removeRestoreStage(stage, backupDir);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  dotenv.config({ path: join(root, ".env"), quiet: true });
  try {
    const mode = process.argv[2];
    const result =
      mode === "backup"
        ? await backup()
        : mode === "verify" || mode === "restore"
          ? await restore(process.argv[3], mode === "verify")
          : (() => {
              throw new Error(
                "Usage: node scripts/recovery.mjs backup --maintenance-confirmed | verify <folder> | restore <folder>",
              );
            })();
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Recovery failed.");
    process.exitCode = 1;
  }
}
