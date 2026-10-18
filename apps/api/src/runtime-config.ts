import { validateMediaStorage } from "@innovia/media-storage";
export function validateRuntime(env: NodeJS.ProcessEnv) {
  const issues: string[] = [];
  try {
    validateMediaStorage(env);
  } catch (error) {
    issues.push(
      error instanceof Error
        ? error.message
        : "Invalid media storage configuration.",
    );
  }
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    if (url.protocol !== "mysql:" || !url.hostname || url.pathname.length < 2)
      issues.push("DATABASE_URL must identify a MySQL database.");
  } catch {
    issues.push("DATABASE_URL must identify a MySQL database.");
  }
  if (env.NODE_ENV === "production") {
    for (const key of ["ADMIN_ORIGIN", "STOREFRONT_ORIGIN"]) {
      try {
        const url = new URL(env[key] ?? "");
        if (url.protocol !== "https:" || url.origin !== env[key])
          issues.push(`${key} must be an exact HTTPS origin.`);
      } catch {
        issues.push(`${key} must be an exact HTTPS origin.`);
      }
    }
    if ((env.APP_SIGNING_SECRET?.length ?? 0) < 32)
      issues.push(
        "APP_SIGNING_SECRET must contain at least 32 random characters.",
      );
    if (!env.REDIS_URL)
      issues.push(
        "REDIS_URL is required for shared rate limits and durable scheduling in production.",
      );
    if (env.MAIL_TRANSPORT === "local")
      issues.push("Local email delivery is only available in development.");
  }
  if (env.REDIS_URL) {
    try {
      const url = new URL(env.REDIS_URL);
      if (
        !["redis:", "rediss:"].includes(url.protocol) ||
        !url.hostname ||
        !/^\/?\d*$/.test(url.pathname)
      )
        issues.push(
          "REDIS_URL must identify a Redis service and numeric database.",
        );
    } catch {
      issues.push(
        "REDIS_URL must identify a Redis service and numeric database.",
      );
    }
  }
  if (env.TRUST_PROXY_HOPS && !/^[0-3]$/.test(env.TRUST_PROXY_HOPS))
    issues.push(
      "TRUST_PROXY_HOPS must be an explicit hop count between 0 and 3.",
    );
  if (
    env.MAIL_PROVIDER_APPROVED === "true" &&
    (!env.RESEND_API_KEY || !env.MAIL_FROM)
  )
    issues.push(
      "Approved mail provider requires RESEND_API_KEY and MAIL_FROM.",
    );
  if (env.PUSH_PROVIDER_APPROVED === "true" && !env.EXPO_ACCESS_TOKEN)
    issues.push("Approved push provider requires EXPO_ACCESS_TOKEN.");
  if (env.AR_PROVIDER_APPROVED === "true" && !env.CAMERA_KIT_WEB_TOKEN)
    issues.push("Approved AR provider requires CAMERA_KIT_WEB_TOKEN.");
  if (env.AI_PROVIDER_APPROVED === "true" && !env.FAL_KEY)
    issues.push("Approved AI provider requires FAL_KEY.");
  if (
    env.BILLING_PROVIDER_APPROVED === "true" &&
    (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)
  )
    issues.push("Approved billing provider requires both Stripe credentials.");
  if (issues.length) throw new Error(issues.join(" "));
}
