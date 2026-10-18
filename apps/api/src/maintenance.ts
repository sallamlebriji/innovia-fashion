import { db } from "./db.js";
import { command, transitionOrderInTransaction } from "./retail.js";
import { expirePoints } from "./loyalty.js";
import { purgeMedia } from "./media.js";
import { runTryOnJobs } from "./try-on.js";
import { runCampaigns } from "./crm-campaigns.js";
import { activateScheduledInvoices } from "./billing.js";
import { runEmails } from "./email.js";
import { runPush } from "./push.js";

export async function runMaintenance() {
  const now = new Date();
  const expired = await db.order.findMany({
    where: { status: "PENDING", reservationExpiresAt: { lte: now } },
    select: { id: true, tenantId: true },
    take: 25,
  });
  let released = 0;
  for (const order of expired) {
    const actor = {
      tenantId: order.tenantId,
      id: "system",
      role: "OWNER" as const,
    };
    await command(
      actor,
      `reservation_expire_${order.id}`,
      { type: "reservation-expiry", id: order.id },
      async (tx) => {
        const current = await tx.order.findUnique({ where: { id: order.id } });
        if (
          current?.status !== "PENDING" ||
          !current.reservationExpiresAt ||
          current.reservationExpiresAt > new Date()
        )
          return { released: false };
        await transitionOrderInTransaction(tx, actor, order.id, "cancel");
        released++;
        return { released: true };
      },
    );
  }
  const lots = await db.loyaltyEntry.findMany({
    where: { remaining: { gt: 0 }, expiresAt: { lte: now } },
    select: { id: true, tenantId: true, accountId: true },
    take: 25,
  });
  for (const lot of lots)
    await command(
      { tenantId: lot.tenantId, id: "system", role: "OWNER" },
      `points_expire_${lot.id}`,
      { type: "points-expiry", id: lot.id },
      async (tx) => {
        await expirePoints(tx, lot.tenantId, lot.accountId);
        return { processed: true };
      },
    );
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.customerSession.deleteMany({ where: { expiresAt: { lt: now } } });
  const mediaCleanup = await purgeMedia();
  await db.recoveryToken.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.platformAudit.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 90 * 86400000) } },
  });
  await runEmails();
  await runPush();
  await runCampaigns();
  await activateScheduledInvoices();
  await runTryOnJobs();
  return {
    reservationsReleased: released,
    pointAccountsChecked: lots.length,
    mediaCleanup,
  };
}
