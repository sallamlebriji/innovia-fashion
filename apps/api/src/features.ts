import type { Prisma } from "@prisma/client";
import { HttpError, requireFound } from "./errors.js";
export const featureNames = [
  "COMMERCE",
  "CMS",
  "LOYALTY",
  "CRM",
  "REPORTS",
  "AI",
  "AR",
] as const;
export type Feature = (typeof featureNames)[number];
export async function requireFeature(
  tx: Prisma.TransactionClient,
  tenantId: string,
  feature: Feature,
) {
  const tenant = requireFound(
    await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: { select: { features: true } } },
    }),
  );
  // Legacy plans retain existing functionality until an operator explicitly configures entitlements.
  if (
    Array.isArray(tenant.plan.features) &&
    !tenant.plan.features.includes(feature)
  )
    throw new HttpError(
      403,
      "FEATURE_REQUIRED",
      `Your subscription does not include ${feature.toLowerCase()}.`,
    );
}
