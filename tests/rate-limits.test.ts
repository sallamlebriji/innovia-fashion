import { it, expect } from "vitest";
import express from "express";
import supertest from "supertest";
import { MemoryStore } from "express-rate-limit";
import { apiRateLimit } from "../apps/api/src/rate-limits.js";

it("rejects excess reads and mutations with a JSON error and a retry delay, then permits a new window", async () => {
  const store = new MemoryStore();
  const app = express();
  app.use(apiRateLimit({ windowMs: 60000, limit: 2, store }));
  app.all("/operation", (_req, res) => res.json({ accepted: true }));
  const request = supertest(app);
  try {
    await request.get("/operation").expect(200);
    await request.post("/operation").expect(200);
    for (const method of ["get", "post"] as const) {
      const response = await request[method]("/operation").expect(429);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.body).toEqual({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please wait and try again.",
        },
      });
      expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
      expect(response.headers.ratelimit).toContain("r=0");
    }
    await store.resetAll();
    await request.post("/operation").expect(200, { accepted: true });
  } finally {
    store.shutdown();
  }
});
