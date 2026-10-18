-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `preferences` JSON NULL;

-- AlterTable
ALTER TABLE `LoyaltyAccount` ADD COLUMN `referralOrderId` VARCHAR(191) NULL,
    ADD COLUMN `referrerAccountId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `LoyaltyEntry` ADD COLUMN `eventKey` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `body` VARCHAR(2000) NOT NULL,
    `segment` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `scheduledAt` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Campaign_status_scheduledAt_idx`(`status`, `scheduledAt`),
    UNIQUE INDEX `Campaign_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CampaignDelivery_tenantId_campaignId_customerId_key`(`tenantId`, `campaignId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `LoyaltyEntry_tenantId_accountId_eventKey_key` ON `LoyaltyEntry`(`tenantId`, `accountId`, `eventKey`);

-- AddForeignKey
ALTER TABLE `LoyaltyAccount` ADD CONSTRAINT `LoyaltyAccount_tenantId_referrerAccountId_fkey` FOREIGN KEY (`tenantId`, `referrerAccountId`) REFERENCES `LoyaltyAccount`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignDelivery` ADD CONSTRAINT `CampaignDelivery_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignDelivery` ADD CONSTRAINT `CampaignDelivery_tenantId_campaignId_fkey` FOREIGN KEY (`tenantId`, `campaignId`) REFERENCES `Campaign`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignDelivery` ADD CONSTRAINT `CampaignDelivery_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
