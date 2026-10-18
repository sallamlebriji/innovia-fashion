import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "./db.js";
import { HttpError } from "./errors.js";
import type { Role } from "@innovia/types";
import { requireSubscription } from "./subscription.js";
import { requireFeature, type Feature } from "./features.js";
const production = () => process.env.NODE_ENV === "production";
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const tenantSelect = {
  id: true,
  name: true,
  slug: true,
  currency: true,
  locale: true,
  demo: true,
  accent: true,
  heroTitle: true,
  heroSubtitle: true,
  heroImage: true,
  plan: { select: { name: true, productLimit: true, storeLimit: true } },
} as const;
export async function startSession(res: Response, userId: string) {
  const token = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      id: digest(token),
      userId,
      csrfToken,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  res.cookie("innovia_session", token, {
    httpOnly: true,
    secure: production(),
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400000,
  });
  return csrfToken;
}
export async function auth(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.innovia_session;
  if (typeof token !== "string" || token.length !== 64)
    throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const session = await db.session.findUnique({
    where: { id: digest(token) },
    include: { user: { include: { tenant: { select: tenantSelect } } } },
  });
  if (!session || !session.user.active || session.expiresAt < new Date())
    throw new HttpError(
      401,
      "SESSION_EXPIRED",
      "Your session has expired. Sign in again.",
    );
  res.locals.session = session;
  res.locals.actor = {
    id: session.user.id,
    role: session.user.role,
    tenantId: session.user.tenantId,
  };
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const csrf = req.get("X-CSRF-Token") ?? "";
    if (
      csrf.length !== session.csrfToken.length ||
      !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrfToken))
    )
      throw new HttpError(
        403,
        "CSRF_REJECTED",
        "Your request could not be verified. Refresh and try again.",
      );
  }
  next();
}
export function permit(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(res.locals.actor.role))
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Your role does not permit this action.",
      );
    next();
  };
}
export async function tenantRequired(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!res.locals.actor.tenantId)
    throw new HttpError(
      403,
      "TENANT_REQUIRED",
      "A merchant account is required.",
    );
  const path = req.originalUrl.split("?")[0]!;
  const feature: Feature | undefined = /\/cms(?:\/|$)/.test(path)
    ? "CMS"
    : /\/(loyalty|rewards)(?:\/|$)/.test(path)
      ? "LOYALTY"
      : /\/(crm|campaigns)(?:\/|$)/.test(path) ||
          /\/customers\/[^/]+\/notes$/.test(path)
        ? "CRM"
        : /\/reports(?:\/|$)/.test(path)
          ? "REPORTS"
          : /\/ai(?:\/|$)/.test(path)
            ? "AI"
            : undefined;
  if (
    feature &&
    (feature === "REPORTS" || !["GET", "HEAD", "OPTIONS"].includes(req.method))
  )
    await requireFeature(db, res.locals.actor.tenantId, feature);
  const financialClosure =
    /\/orders\/[^/]+\/(complete|cancel|refund|delivery)$/.test(
      req.originalUrl,
    ) || /\/returns$/.test(req.originalUrl);
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    !financialClosure &&
    !/\/(support|registers|billing)(?:\/|$)/.test(req.originalUrl)
  )
    await db.$transaction((tx) =>
      requireSubscription(tx, res.locals.actor.tenantId),
    );
  next();
}
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
export function safeUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  };
}
