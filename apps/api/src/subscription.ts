import type { Prisma } from "@prisma/client";
import { HttpError, requireFound } from "./errors.js";
export async function requireSubscription(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  const tenant = requireFound(
    await tx.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
        paidThrough: true,
      },
    }),
  );
  if (
    !(
      tenant.subscriptionStatus === "ACTIVE" &&
      (!tenant.paidThrough || tenant.paidThrough > new Date())
    ) &&
    !(
      tenant.subscriptionStatus === "TRIAL" &&
      tenant.trialEndsAt &&
      tenant.trialEndsAt > new Date()
    )
  )
    throw new HttpError(
      403,
      "SUBSCRIPTION_REQUIRED",
      "Your subscription needs attention. Existing records remain available; contact INNOVIA support to activate a plan.",
    );
}
