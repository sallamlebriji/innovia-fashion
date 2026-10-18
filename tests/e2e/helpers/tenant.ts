import { PrismaClient } from "@prisma/client";
import { getMediaStore, closeMediaStorage } from "@innovia/media-storage";
export async function cleanupBrowserTenant(tenantId: string, business: string) {
  if (!tenantId) return;
  const db = new PrismaClient();
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (tenant?.name !== business || process.env.NODE_ENV === "production")
    throw new Error("Refusing fixture cleanup.");
  const users = await db.user.findMany({
    where: { tenantId },
    select: { id: true },
  });
  await db.session.deleteMany({
    where: { userId: { in: users.map((x) => x.id) } },
  });
  const where = { tenantId };
  await db.billingEvent.deleteMany({ where });
  await db.subscriptionInvoice.deleteMany({ where });
  await db.staffInvite.deleteMany({ where });
  await db.supportMessage.deleteMany({ where });
  await db.supportTicket.deleteMany({ where });
  await db.rewardRedemption.deleteMany({ where });
  await db.customerSession.deleteMany({ where });
  await db.customerAddress.deleteMany({ where });
  await db.customerConsent.deleteMany({ where });
  await db.wishlistItem.deleteMany({ where });
  await db.notification.deleteMany({ where });
  await db.campaignDelivery.deleteMany({ where });
  await db.campaign.deleteMany({ where });
  await db.aICreditEntry.deleteMany({ where });
  await db.tryOnJob.deleteMany({ where });
  await db.aIUsage.deleteMany({ where });
  await db.cashMovement.deleteMany({ where });
  await db.cashSession.deleteMany({ where });
  const media = await db.mediaAsset.findMany({ where });
  for (const asset of media) {
    const store = getMediaStore({
      ...process.env,
      MEDIA_STORAGE: asset.storageDriver.toLowerCase(),
    });
    await store.remove(asset.storageKey);
  }
  closeMediaStorage();
  await db.mediaAsset.deleteMany({ where });
  await db.cMSSection.deleteMany({ where });
  await db.cMSPage.deleteMany({ where });
  await db.loyaltyEntry.deleteMany({ where });
  await db.loyaltyAccount.updateMany({
    where,
    data: { referrerAccountId: null },
  });
  await db.loyaltyAccount.deleteMany({ where });
  await db.loyaltyTier.deleteMany({ where });
  await db.loyaltyProgram.deleteMany({ where });
  await db.reward.deleteMany({ where });
  await db.returnItem.deleteMany({ where });
  await db.returnRecord.deleteMany({ where });
  await db.stockTransfer.deleteMany({ where });
  await db.stockCount.deleteMany({ where });
  await db.purchaseOrderItem.deleteMany({ where });
  await db.purchaseOrder.deleteMany({ where });
  await db.supplier.deleteMany({ where });
  await db.productMedia.deleteMany({ where });
  await db.idempotentCommand.deleteMany({ where });
  await db.auditLog.deleteMany({ where });
  await db.orderItem.deleteMany({ where });
  await db.order.deleteMany({ where });
  await db.coupon.deleteMany({ where });
  await db.deliveryZone.deleteMany({ where });
  await db.stockMovement.deleteMany({ where });
  await db.inventory.deleteMany({ where });
  await db.productVariant.deleteMany({ where });
  await db.product.deleteMany({ where });
  await db.customer.deleteMany({ where });
  await db.user.deleteMany({ where });
  await db.store.deleteMany({ where });
  await db.tenant.delete({ where: { id: tenantId } });
  await db.$disconnect();
}
