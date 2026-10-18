import { rateLimit } from "express-rate-limit";

export function apiRateLimit(options: Parameters<typeof rateLimit>[0]) {
  return rateLimit({
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...options,
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please wait and try again.",
      },
    },
  });
}
