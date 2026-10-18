-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `requireCashSession` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `cashierId` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `couponId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `CashSession` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `activeStoreId` VARCHAR(191) NULL,
    `openedBy` VARCHAR(191) NOT NULL,
    `openedByName` VARCHAR(191) NOT NULL,
    `closedBy` VARCHAR(191) NULL,
    `openingCash` DECIMAL(12, 2) NOT NULL,
    `countedCash` DECIMAL(12, 2) NULL,
    `expectedCash` DECIMAL(12, 2) NULL,
    `variance` DECIMAL(12, 2) NULL,
    `closingNote` VARCHAR(1000) NOT NULL DEFAULT '',
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,

    INDEX `CashSession_tenantId_openedAt_idx`(`tenantId`, `openedAt`),
    UNIQUE INDEX `CashSession_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `CashSession_tenantId_activeStoreId_key`(`tenantId`, `activeStoreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashMovement` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CashMovement_tenantId_sessionId_createdAt_idx`(`tenantId`, `sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Coupon` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `value` DECIMAL(12, 2) NOT NULL,
    `minimum` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `maximumUses` INTEGER NOT NULL DEFAULT 100,
    `used` INTEGER NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Coupon_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `Coupon_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_tenantId_couponId_fkey` FOREIGN KEY (`tenantId`, `couponId`) REFERENCES `Coupon`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashSession` ADD CONSTRAINT `CashSession_tenantId_storeId_fkey` FOREIGN KEY (`tenantId`, `storeId`) REFERENCES `Store`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_tenantId_sessionId_fkey` FOREIGN KEY (`tenantId`, `sessionId`) REFERENCES `CashSession`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashMovement` ADD CONSTRAINT `CashMovement_tenantId_orderId_fkey` FOREIGN KEY (`tenantId`, `orderId`) REFERENCES `Order`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Coupon` ADD CONSTRAINT `Coupon_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
