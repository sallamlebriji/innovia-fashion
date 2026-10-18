-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `tryOnEnabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `tryOnEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `tryOnImageUrl` VARCHAR(2048) NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE `TryOnJob` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `photoId` VARCHAR(191) NOT NULL,
    `outputId` VARCHAR(191) NULL,
    `period` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
    `provider` VARCHAR(191) NOT NULL DEFAULT 'FAL',
    `providerRequestId` VARCHAR(191) NULL,
    `garmentUrl` VARCHAR(2048) NOT NULL,
    `consentVersion` VARCHAR(191) NOT NULL,
    `errorCode` VARCHAR(191) NOT NULL DEFAULT '',
    `creditedBack` BOOLEAN NOT NULL DEFAULT false,
    `leaseToken` VARCHAR(191) NULL,
    `leaseUntil` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TryOnJob_providerRequestId_key`(`providerRequestId`),
    INDEX `TryOnJob_status_leaseUntil_createdAt_idx`(`status`, `leaseUntil`, `createdAt`),
    INDEX `TryOnJob_tenantId_customerId_createdAt_idx`(`tenantId`, `customerId`, `createdAt`),
    UNIQUE INDEX `TryOnJob_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIUsage` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `used` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `AIUsage_tenantId_period_key`(`tenantId`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AICreditEntry` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `credits` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AICreditEntry_tenantId_period_idx`(`tenantId`, `period`),
    UNIQUE INDEX `AICreditEntry_tenantId_jobId_type_key`(`tenantId`, `jobId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `MediaAsset_tenantId_id_key` ON `MediaAsset`(`tenantId`, `id`);

-- AddForeignKey
ALTER TABLE `TryOnJob` ADD CONSTRAINT `TryOnJob_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TryOnJob` ADD CONSTRAINT `TryOnJob_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TryOnJob` ADD CONSTRAINT `TryOnJob_tenantId_productId_fkey` FOREIGN KEY (`tenantId`, `productId`) REFERENCES `Product`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TryOnJob` ADD CONSTRAINT `TryOnJob_tenantId_photoId_fkey` FOREIGN KEY (`tenantId`, `photoId`) REFERENCES `MediaAsset`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TryOnJob` ADD CONSTRAINT `TryOnJob_tenantId_outputId_fkey` FOREIGN KEY (`tenantId`, `outputId`) REFERENCES `MediaAsset`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIUsage` ADD CONSTRAINT `AIUsage_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AICreditEntry` ADD CONSTRAINT `AICreditEntry_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AICreditEntry` ADD CONSTRAINT `AICreditEntry_tenantId_jobId_fkey` FOREIGN KEY (`tenantId`, `jobId`) REFERENCES `TryOnJob`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;
