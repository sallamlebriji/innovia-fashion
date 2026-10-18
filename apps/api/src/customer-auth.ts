import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
import { HttpError } from "./errors.js";
export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const customerProfileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  birthday: true,
  preferences: true,
  createdAt: true,
} as const;
export const customerDirectorySelect = {
  ...customerProfileSelect,
  _count: { select: { orders: true } },
} as const;
export const customerOrderSelect = {
  id: true,
  number: true,
  customerName: true,
  channel: true,
  status: true,
  paymentMethod: true,
  total: true,
  refundedTotal: true,
  discountTotal: true,
  shippingTotal: true,
  taxTotal: true,
  taxRate: true,
  currency: true,
  deliveryStatus: true,
  carrier: true,
  trackingNumber: true,
  reservationExpiresAt: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      name: true,
      sku: true,
      quantity: true,
      unitPrice: true,
      returnedQuantity: true,
      returnedAmount: true,
      discountTotal: true,
    },
  },
  store: { select: { id: true, name: true, city: true } },
} as const;
export const customerCookie = (tenantId: string) =>
  `innovia_customer_${tenantId}`;
export async function startCustomerSession(
  res: Response,
  tenantId: string,
  customerId: string,
  native: boolean,
) {
  const token = randomBytes(32).toString("hex"),
    csrfToken = randomBytes(32).toString("hex");
  await db.customerSession.create({
    data: {
      id: tokenHash(token),
      tenantId,
      customerId,
      csrfToken,
      expiresAt: new Date(Date.now() + 30 * 86400000),
    },
  });
  if (!native)
    res.cookie(customerCookie(tenantId), token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 86400000,
    });
  return { csrfToken, ...(native ? { token } : {}) };
}
export async function customerAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const tenantId: string = res.locals.boutique.id;
  const bearer = req
    .get("Authorization")
    ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const token: unknown = bearer ?? req.cookies?.[customerCookie(tenantId)];
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(
      401,
      "CUSTOMER_SESSION",
      "Sign in to your boutique account.",
    );
  const session = await db.customerSession.findFirst({
    where: { id: tokenHash(token), tenantId, expiresAt: { gt: new Date() } },
    include: { customer: { select: customerProfileSelect } },
  });
  if (!session)
    throw new HttpError(
      401,
      "CUSTOMER_SESSION",
      "Your boutique session has expired.",
    );
  if (!bearer && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const csrf = req.get("X-CSRF-Token") ?? "";
    if (
      csrf.length !== session.csrfToken.length ||
      !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrfToken))
    )
      throw new HttpError(
        403,
        "CSRF_REJECTED",
        "Refresh your boutique session and try again.",
      );
  }
  res.locals.customerSession = session;
  res.locals.customerActor = {
    id: session.customerId,
    tenantId,
    role: "CASHIER",
  };
  next();
}
