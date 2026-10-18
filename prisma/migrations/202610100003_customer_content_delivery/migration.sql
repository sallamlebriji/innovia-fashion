-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `contactEmail` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `contactPhone` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `deliveryPolicy` VARCHAR(5000) NOT NULL DEFAULT '',
    ADD COLUMN `invoiceAddress` VARCHAR(500) NOT NULL DEFAULT '',
    ADD COLUMN `legalName` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `refundShipping` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reservationMinutes` INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN `returnPolicy` VARCHAR(5000) NOT NULL DEFAULT '',
    ADD COLUMN `taxIdentifier` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `birthday` DATETIME(3) NULL,
    ADD COLUMN `notes` VARCHAR(2000) NOT NULL DEFAULT '',
    ADD COLUMN `passwordHash` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `carrier` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `deliveryStatus` VARCHAR(191) NOT NULL DEFAULT 'AWAITING_COLLECTION',
    ADD COLUMN `deliveryZoneId` VARCHAR(191) NULL,
    ADD COLUMN `refundShipping` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reservationExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `shippingAddress` JSON NULL,
    ADD COLUMN `shippingTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `taxTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `trackingNumber` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `trackingTokenHash` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'IN_FULFILMENT') NOT NULL;

-- CreateTable
CREATE TABLE `CustomerSession` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `csrfToken` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `CustomerSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerAddress` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `street` VARCHAR(500) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `postalCode` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'MA',

    INDEX `CustomerAddress_tenantId_customerId_idx`(`tenantId`, `customerId`),
    UNIQUE INDEX `CustomerAddress_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerConsent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `granted` BOOLEAN NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CustomerConsent_tenantId_customerId_purpose_key`(`tenantId`, `customerId`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WishlistItem` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WishlistItem_tenantId_customerId_productId_key`(`tenantId`, `customerId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryZone` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `cities` JSON NOT NULL,
    `fee` DECIMAL(12, 2) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `DeliveryZone_tenantId_active_idx`(`tenantId`, `active`),
    UNIQUE INDEX `DeliveryZone_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CMSPage` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL DEFAULT 'home',
    `title` VARCHAR(191) NOT NULL,
    `seoTitle` VARCHAR(191) NOT NULL DEFAULT '',
    `seoDescription` VARCHAR(500) NOT NULL DEFAULT '',
    `published` JSON NULL,
    `publishedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CMSPage_tenantId_slug_key`(`tenantId`, `slug`),
    UNIQUE INDEX `CMSPage_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CMSSection` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(3000) NOT NULL,
    `imageUrl` VARCHAR(2048) NOT NULL,
    `ctaLabel` VARCHAR(191) NOT NULL,
    `ctaHref` VARCHAR(2048) NOT NULL,
    `collection` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,

    INDEX `CMSSection_tenantId_pageId_position_idx`(`tenantId`, `pageId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(3000) NOT NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'IN_APP',
    `status` VARCHAR(191) NOT NULL DEFAULT 'DELIVERED',
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_tenantId_customerId_createdAt_idx`(`tenantId`, `customerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `bytes` INTEGER NOT NULL,
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'PUBLIC',
    `purpose` VARCHAR(191) NOT NULL DEFAULT 'CAMPAIGN',
    `customerId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MediaAsset_storageKey_key`(`storageKey`),
    INDEX `MediaAsset_tenantId_visibility_createdAt_idx`(`tenantId`, `visibility`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_tenantId_deliveryZoneId_fkey` FOREIGN KEY (`tenantId`, `deliveryZoneId`) REFERENCES `DeliveryZone`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerSession` ADD CONSTRAINT `CustomerSession_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerSession` ADD CONSTRAINT `CustomerSession_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerAddress` ADD CONSTRAINT `CustomerAddress_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerAddress` ADD CONSTRAINT `CustomerAddress_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerConsent` ADD CONSTRAINT `CustomerConsent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerConsent` ADD CONSTRAINT `CustomerConsent_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WishlistItem` ADD CONSTRAINT `WishlistItem_tenantId_productId_fkey` FOREIGN KEY (`tenantId`, `productId`) REFERENCES `Product`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryZone` ADD CONSTRAINT `DeliveryZone_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CMSPage` ADD CONSTRAINT `CMSPage_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CMSSection` ADD CONSTRAINT `CMSSection_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CMSSection` ADD CONSTRAINT `CMSSection_tenantId_pageId_fkey` FOREIGN KEY (`tenantId`, `pageId`) REFERENCES `CMSPage`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
