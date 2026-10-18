import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { validateRuntime } from "../apps/api/src/runtime-config.js";
const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "mysql://user:secret@db:3306/innovia",
  ADMIN_ORIGIN: "https://admin.example.test",
  STOREFRONT_ORIGIN: "https://shop.example.test",
  APP_SIGNING_SECRET: "a".repeat(64),
  MEDIA_DIR: resolve(".local/media"),
  REDIS_URL: "rediss://cache.example.test:6379/0",
};
describe("production startup configuration", () => {
  it("accepts configured S3 with IAM credentials and rejects insecure provider endpoints", () => {
    const env = {
      ...valid,
      MEDIA_DIR: undefined,
      MEDIA_STORAGE: "s3",
      MEDIA_S3_BUCKET: "innovia-private-media",
      MEDIA_S3_REGION: "eu-west-1",
    };
    expect(() => validateRuntime(env)).not.toThrow();
    expect(() =>
      validateRuntime({ ...env, MEDIA_S3_ENDPOINT: "http://localhost:9000" }),
    ).toThrow("HTTPS");
    expect(() => validateRuntime({ ...env, MEDIA_S3_REGION: "" })).toThrow(
      "REGION",
    );
  });
  it("accepts HTTPS origins and explicitly configured persistent media", () =>
    expect(() => validateRuntime(valid)).not.toThrow());
  it("rejects incomplete production setup without exposing credentials", () => {
    expect(() =>
      validateRuntime({
        ...valid,
        ADMIN_ORIGIN: "http://localhost",
        APP_SIGNING_SECRET: "short",
        MEDIA_DIR: "relative",
      }),
    ).toThrow("exact HTTPS origin");
    expect(() =>
      validateRuntime({ ...valid, DATABASE_URL: "bad-secret-value" }),
    ).toThrow("DATABASE_URL must identify a MySQL database.");
  });
  it("requires credentials before enabling paid providers", () => {
    expect(() =>
      validateRuntime({ ...valid, AI_PROVIDER_APPROVED: "true" }),
    ).toThrow("requires FAL_KEY");
    expect(() =>
      validateRuntime({
        ...valid,
        BILLING_PROVIDER_APPROVED: "true",
        STRIPE_SECRET_KEY: "secret",
      }),
    ).toThrow("both Stripe credentials");
  });
  it("requires shared production infrastructure and rejects local mail or ambiguous proxy trust", () => {
    expect(() => validateRuntime({ ...valid, REDIS_URL: "" })).toThrow(
      "REDIS_URL is required",
    );
    expect(() =>
      validateRuntime({ ...valid, REDIS_URL: "https://cache.test" }),
    ).toThrow("Redis service");
    expect(() =>
      validateRuntime({ ...valid, MAIL_TRANSPORT: "local" }),
    ).toThrow("only available in development");
    expect(() =>
      validateRuntime({ ...valid, TRUST_PROXY_HOPS: "true" }),
    ).toThrow("explicit hop count");
  });
});
