-- AlterTable
ALTER TABLE `Order` ADD COLUMN `discountTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `loyaltyPoints` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `refundedTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    MODIFY `status` ENUM('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `discountTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `returnedAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `returnedQuantity` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `ReturnRecord` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `replacementOrderId` VARCHAR(191) NULL,
    `reason` VARCHAR(500) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `cashDifference` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `actorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ReturnRecord_replacementOrderId_key`(`replacementOrderId`),
    INDEX `ReturnRecord_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    UNIQUE INDEX `ReturnRecord_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `ReturnRecord_tenantId_replacementOrderId_key`(`tenantId`, `replacementOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReturnItem` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `returnId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `restock` BOOLEAN NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,

    INDEX `ReturnItem_tenantId_returnId_idx`(`tenantId`, `returnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyProgram` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `name` VARCHAR(191) NOT NULL DEFAULT 'Members club',
    `spendUnit` DECIMAL(12, 2) NOT NULL DEFAULT 10,
    `pointsPerUnit` INTEGER NOT NULL DEFAULT 1,
    `expiryDays` INTEGER NOT NULL DEFAULT 365,
    `birthdayPoints` INTEGER NOT NULL DEFAULT 0,
    `referralPoints` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `LoyaltyProgram_tenantId_key`(`tenantId`),
    UNIQUE INDEX `LoyaltyProgram_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyTier` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `threshold` INTEGER NOT NULL,
    `benefits` VARCHAR(1000) NOT NULL,
    `multiplier` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `LoyaltyTier_tenantId_programId_threshold_key`(`tenantId`, `programId`, `threshold`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyAccount` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `cardCode` VARCHAR(191) NOT NULL,
    `points` INTEGER NOT NULL DEFAULT 0,
    `lifetimePoints` INTEGER NOT NULL DEFAULT 0,
    `enrolledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `consentAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LoyaltyAccount_cardCode_key`(`cardCode`),
    UNIQUE INDEX `LoyaltyAccount_tenantId_customerId_key`(`tenantId`, `customerId`),
    UNIQUE INDEX `LoyaltyAccount_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyEntry` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `points` INTEGER NOT NULL,
    `remaining` INTEGER NOT NULL DEFAULT 0,
    `expiredPoints` INTEGER NOT NULL DEFAULT 0,
    `type` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LoyaltyEntry_tenantId_accountId_createdAt_idx`(`tenantId`, `accountId`, `createdAt`),
    INDEX `LoyaltyEntry_expiresAt_remaining_idx`(`expiresAt`, `remaining`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reward` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `pointsCost` INTEGER NOT NULL,
    `discountValue` DECIMAL(12, 2) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Reward_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RewardRedemption` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `rewardId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `code` VARCHAR(191) NOT NULL,
    `pointsCost` INTEGER NOT NULL,
    `discountValue` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ISSUED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RewardRedemption_orderId_key`(`orderId`),
    UNIQUE INDEX `RewardRedemption_code_key`(`code`),
    INDEX `RewardRedemption_tenantId_accountId_idx`(`tenantId`, `accountId`),
    UNIQUE INDEX `RewardRedemption_tenantId_id_key`(`tenantId`, `id`),
    UNIQUE INDEX `RewardRedemption_tenantId_orderId_key`(`tenantId`, `orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `OrderItem_tenantId_id_key` ON `OrderItem`(`tenantId`, `id`);

-- AddForeignKey
ALTER TABLE `ReturnRecord` ADD CONSTRAINT `ReturnRecord_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReturnRecord` ADD CONSTRAINT `ReturnRecord_tenantId_orderId_fkey` FOREIGN KEY (`tenantId`, `orderId`) REFERENCES `Order`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReturnRecord` ADD CONSTRAINT `ReturnRecord_tenantId_replacementOrderId_fkey` FOREIGN KEY (`tenantId`, `replacementOrderId`) REFERENCES `Order`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReturnItem` ADD CONSTRAINT `ReturnItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReturnItem` ADD CONSTRAINT `ReturnItem_tenantId_returnId_fkey` FOREIGN KEY (`tenantId`, `returnId`) REFERENCES `ReturnRecord`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReturnItem` ADD CONSTRAINT `ReturnItem_tenantId_orderItemId_fkey` FOREIGN KEY (`tenantId`, `orderItemId`) REFERENCES `OrderItem`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyProgram` ADD CONSTRAINT `LoyaltyProgram_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyTier` ADD CONSTRAINT `LoyaltyTier_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyTier` ADD CONSTRAINT `LoyaltyTier_tenantId_programId_fkey` FOREIGN KEY (`tenantId`, `programId`) REFERENCES `LoyaltyProgram`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyAccount` ADD CONSTRAINT `LoyaltyAccount_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyAccount` ADD CONSTRAINT `LoyaltyAccount_tenantId_customerId_fkey` FOREIGN KEY (`tenantId`, `customerId`) REFERENCES `Customer`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyEntry` ADD CONSTRAINT `LoyaltyEntry_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyEntry` ADD CONSTRAINT `LoyaltyEntry_tenantId_accountId_fkey` FOREIGN KEY (`tenantId`, `accountId`) REFERENCES `LoyaltyAccount`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyEntry` ADD CONSTRAINT `LoyaltyEntry_tenantId_orderId_fkey` FOREIGN KEY (`tenantId`, `orderId`) REFERENCES `Order`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reward` ADD CONSTRAINT `Reward_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardRedemption` ADD CONSTRAINT `RewardRedemption_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardRedemption` ADD CONSTRAINT `RewardRedemption_tenantId_accountId_fkey` FOREIGN KEY (`tenantId`, `accountId`) REFERENCES `LoyaltyAccount`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardRedemption` ADD CONSTRAINT `RewardRedemption_tenantId_rewardId_fkey` FOREIGN KEY (`tenantId`, `rewardId`) REFERENCES `Reward`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RewardRedemption` ADD CONSTRAINT `RewardRedemption_tenantId_orderId_fkey` FOREIGN KEY (`tenantId`, `orderId`) REFERENCES `Order`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Order` ADD CONSTRAINT `Order_refund_amount_check` CHECK (`refundedTotal` >= 0 AND `refundedTotal` <= `total` AND `discountTotal` >= 0);
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_return_quantity_check` CHECK (`returnedQuantity` >= 0 AND `returnedQuantity` <= `quantity` AND `returnedAmount` >= 0 AND `discountTotal` >= 0);
ALTER TABLE `ReturnItem` ADD CONSTRAINT `ReturnItem_quantity_check` CHECK (`quantity` > 0 AND `amount` >= 0);
ALTER TABLE `LoyaltyProgram` ADD CONSTRAINT `LoyaltyProgram_rules_check` CHECK (`spendUnit` > 0 AND `pointsPerUnit` > 0 AND `expiryDays` >= 0);
ALTER TABLE `LoyaltyEntry` ADD CONSTRAINT `LoyaltyEntry_remaining_check` CHECK (`remaining` >= 0 AND `expiredPoints` >= 0);
ALTER TABLE `Reward` ADD CONSTRAINT `Reward_value_check` CHECK (`pointsCost` > 0 AND `discountValue` > 0);
