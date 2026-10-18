import { Redis } from "ioredis";
import { RedisStore } from "rate-limit-redis";
import { Queue, Worker } from "bullmq";
import type { RedisReply } from "rate-limit-redis";

let redis: Redis | undefined;
function client() {
  if (!process.env.REDIS_URL) return;
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5000,
    });
    // Callers handle connection failures without logging credentials or URLs.
    redis.on("error", () => {});
    void redis.connect().catch(() => {});
  }
  return redis;
}
export function rateStore(name: string) {
  const connection = client();
  return connection
    ? {
        store: new RedisStore({
          prefix: `innovia:rate:${name}:`,
          sendCommand: async (...args: string[]) =>
            (await connection.call(args[0]!, ...args.slice(1))) as RedisReply,
        }),
      }
    : {};
}
export async function checkInfrastructure() {
  const connection = client();
  if (connection) {
    if (connection.status !== "ready")
      await new Promise<void>((resolve, reject) => {
        const ready = () => {
          connection.off("error", failed);
          resolve();
        };
        const failed = () => {
          connection.off("ready", ready);
          reject(
            new Error("Redis connection failed. Check the configured service."),
          );
        };
        connection.once("ready", ready);
        connection.once("error", failed);
      });
    await connection.ping();
  }
}
export async function startMaintenance(
  run: () => Promise<unknown>,
  failure: () => void,
) {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db: Number(url.pathname.slice(1) || 0),
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
    const queue = new Queue("innovia-maintenance", { connection });
    queue.on("error", failure);
    await queue.setGlobalConcurrency(1);
    await queue.upsertJobScheduler(
      "maintenance-v1",
      { every: 30000 },
      {
        name: "maintenance",
        data: {},
        opts: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      },
    );
    const worker = new Worker("innovia-maintenance", run, {
      connection,
      concurrency: 1,
    });
    worker.on("error", failure);
    worker.on("failed", failure);
    await worker.waitUntilReady();
    return async () => {
      await worker.close();
      await queue.close();
    };
  }
  // The single-process development runner uses the same persisted database leases.
  let active: Promise<unknown> | undefined;
  const timer = setInterval(() => {
    if (!active)
      active = run()
        .catch(failure)
        .finally(() => {
          active = undefined;
        });
  }, 30000);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await active;
  };
}
export async function closeInfrastructure() {
  redis?.disconnect();
  redis = undefined;
}
