import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
dotenv.config({ quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "TEST_DATABASE_URL must point to a separate database ending in _test.",
  );
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" },
);
process.exit(result.status ?? 1);
