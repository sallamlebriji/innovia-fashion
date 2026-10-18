import assert from "node:assert/strict";
import express from "express";
import supertest from "supertest";
import { rateLimit } from "express-rate-limit";
import { Redis } from "ioredis";
import { Queue } from "bullmq";
import { randomUUID } from "node:crypto";

if (process.env.NODE_ENV === "production")
  throw new Error("Redis acceptance cannot run in production.");
const target = new URL(
  process.env.REDIS_TEST_URL ?? "redis://127.0.0.1:6380/15",
);
if (
  target.protocol !== "redis:" ||
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  target.pathname !== "/15"
)
  throw new Error(
    "Redis acceptance requires a dedicated empty localhost database 15.",
  );
process.env.REDIS_URL = target.toString();
const connection = {
  host: target.hostname,
  port: Number(target.port || 6379),
  db: 15,
  username: target.username ? decodeURIComponent(target.username) : undefined,
  password: target.password ? decodeURIComponent(target.password) : undefined,
};
const redis = new Redis({
  ...connection,
  connectTimeout: 3000,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null,
});
redis.on("error", () => {});
let queue;
const {
  rateStore,
  checkInfrastructure,
  startMaintenance,
  closeInfrastructure,
} = await import("../apps/api/src/infrastructure.ts");
const stops = [];
let ownsDatabase = false;
try {
  await redis.ping();
  assert.equal(
    await redis.dbsize(),
    0,
    "Redis acceptance database must be empty; existing keys are never removed.",
  );
  ownsDatabase = true;
  queue = new Queue("innovia-maintenance", { connection });
  queue.on("error", () => {});
  await checkInfrastructure();
  const app = () => {
    const instance = express();
    instance.use(
      rateLimit({ windowMs: 60000, limit: 2, ...rateStore("acceptance") }),
    );
    instance.get("/", (_req, res) => res.json({ ok: true }));
    return instance;
  };
  const first = app(),
    second = app();
  await supertest(first).get("/").expect(200);
  await supertest(second).get("/").expect(200);
  await supertest(first).get("/").expect(429);
  let active = 0,
    maximum = 0,
    completed = 0,
    failures = 0;
  const run = async () => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 40));
    active--;
    completed++;
  };
  const failed = () => {
    failures++;
  };
  stops.push(await startMaintenance(run, failed));
  stops.push(await startMaintenance(run, failed));
  assert.equal(
    await queue.getJobSchedulersCount(),
    1,
    "Repeated API startup must share one scheduler.",
  );
  const jobs = [];
  for (let index = 0; index < 8; index++)
    jobs.push(await queue.add("acceptance", {}, { jobId: randomUUID() }));
  const deadline = Date.now() + 20000;
  while (
    Date.now() < deadline &&
    !(await Promise.all(jobs.map((job) => job.isCompleted()))).every(Boolean)
  )
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    (await Promise.all(jobs.map((job) => job.isCompleted()))).every(Boolean),
    true,
  );
  assert.equal(
    maximum,
    1,
    "Multiple workers must preserve global maintenance concurrency one.",
  );
  assert.equal(completed >= 8, true);
  assert.equal(failures, 0);
  console.log(
    "Redis acceptance passed: shared rate limits, stable durable scheduler and two workers with global concurrency one.",
  );
} finally {
  for (const stop of stops.reverse()) await stop();
  await queue?.close();
  await closeInfrastructure();
  if (ownsDatabase) {
    // Only keys in the initially empty, explicitly validated local test database belong to this run.
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "COUNT", "100");
      cursor = next;
      const ownKeys = keys.filter(
        (key) =>
          key.startsWith("innovia:rate:acceptance:") ||
          key.startsWith("bull:innovia-maintenance:"),
      );
      if (ownKeys.length) await redis.del(...ownKeys);
    } while (cursor !== "0");
  }
  redis.disconnect();
}
