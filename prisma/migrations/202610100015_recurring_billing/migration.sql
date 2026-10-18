-- DropForeignKey
ALTER TABLE `PushDelivery` DROP FOREIGN KEY `PushDelivery_device_fkey`;

-- DropForeignKey
ALTER TABLE `PushDelivery` DROP FOREIGN KEY `PushDelivery_notification_fkey`;

-- DropForeignKey
ALTER TABLE `PushDevice` DROP FOREIGN KEY `PushDevice_customer_fkey`;

-- AlterTable
ALTER TABLE `SubscriptionInvoice` ADD COLUMN `providerInvoiceId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `RecurringBilling` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `planName` VARCHAR(191) NOT NULL,
    `monthlyPrice` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'MAD',
    `attemptKey` VARCHAR(191) NOT NULL,
    `checkoutSessionId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ENROLLING',
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `currentPeriodEnd` DATETIME(3) NULL,
    `lastStateEvent` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RecurringBilling_customerId_key`(`customerId`),
    UNIQUE INDEX `RecurringBilling_subscriptionId_key`(`subscriptionId`),
    INDEX `RecurringBilling_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    UNIQUE INDEX `RecurringBilling_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecurringBillingEvent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `billingId` VARCHAR(191) NOT NULL,
    `objectId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RecurringBillingEvent_tenantId_receivedAt_idx`(`tenantId`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `SubscriptionInvoice_providerInvoiceId_key` ON `SubscriptionInvoice`(`providerInvoiceId`);

-- AddForeignKey
ALTER TABLE `PushDevice` ADD CONSTRAINT `PushDevice_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PushDelivery` ADD CONSTRAINT `PushDelivery_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `Notification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PushDelivery` ADD CONSTRAINT `PushDelivery_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `PushDevice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecurringBilling` ADD CONSTRAINT `RecurringBilling_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecurringBilling` ADD CONSTRAINT `RecurringBilling_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `SubscriptionPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecurringBillingEvent` ADD CONSTRAINT `RecurringBillingEvent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecurringBillingEvent` ADD CONSTRAINT `RecurringBillingEvent_tenantId_billingId_fkey` FOREIGN KEY (`tenantId`, `billingId`) REFERENCES `RecurringBilling`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

