import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
dotenv.config({ quiet: true });
if (process.platform !== "win32" || process.env.NODE_ENV === "production")
  throw new Error(
    "Use this verification helper only with the project-local Windows MySQL instance.",
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
    throw new Error("Local MySQL verification command failed.");
  return result.stdout.trim();
}
const actual = resolve(sql("SELECT @@datadir"))
  .replace(/[\\/]+$/, "")
  .toLowerCase();
if (actual !== resolve(".local/mysql-data").toLowerCase())
  throw new Error("Refusing to use a database server outside this project.");
const target = new URL(process.env.TEST_DATABASE_URL);
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "3308" ||
  target.username !== "innovia" ||
  !target.pathname.endsWith("_test")
)
  throw new Error("Expected this project's isolated MySQL test configuration.");
const database = `innovia_migrations_${randomUUID().replaceAll("-", "").slice(0, 12)}_test`;
sql(
  `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON \`${database}\`.* TO 'innovia'@'127.0.0.1';`,
);
try {
  target.pathname = `/${database}`;
  const migrated = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      env: { ...process.env, DATABASE_URL: target.toString() },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  if (migrated.status !== 0)
    throw new Error("Fresh migration verification failed.");
  const count = sql(
    `SELECT COUNT(*) FROM \`${database}\`._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
  );
  console.log(
    `Fresh empty database: ${count} migrations successfully applied.`,
  );
} finally {
  // This schema name is created above from a fixed prefix and a validated random suffix.
  if (!/^innovia_migrations_[a-f0-9]{12}_test$/.test(database))
    throw new Error("Refusing cleanup of an unexpected schema.");
  sql(
    `DROP DATABASE \`${database}\`; REVOKE ALL ON \`${database}\`.* FROM 'innovia'@'127.0.0.1';`,
  );
}
