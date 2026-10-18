-- AlterTable
ALTER TABLE `Store` ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'STORE';

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `audience` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `care` VARCHAR(2000) NOT NULL DEFAULT '',
    ADD COLUMN `fit` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `material` VARCHAR(200) NOT NULL DEFAULT '',
    ADD COLUMN `season` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `sizeChart` JSON NULL;

-- AlterTable
ALTER TABLE `ProductVariant` ADD COLUMN `barcode` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `StockMovement` MODIFY `reason` VARCHAR(1000) NOT NULL;

-- CreateTable
CREATE TABLE `ProductMedia` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `alt` VARCHAR(200) NOT NULL DEFAULT '',
    `kind` VARCHAR(191) NOT NULL DEFAULT 'IMAGE',
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `ProductMedia_tenantId_productId_position_idx`(`tenantId`, `productId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `phone` VARCHAR(191) NOT NULL DEFAULT '',
    `address` VARCHAR(500) NOT NULL DEFAULT '',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Supplier_tenantId_name_idx`(`tenantId`, `name`),
    UNIQUE INDEX `Supplier_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `currency` VARCHAR(191) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `notes` VARCHAR(2000) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PurchaseOrder_number_key`(`number`),
    INDEX `PurchaseOrder_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    UNIQUE INDEX `PurchaseOrder_tenantId_id_key`(`tenantId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitCost` DECIMAL(12, 2) NOT NULL,

    INDEX `PurchaseOrderItem_tenantId_purchaseOrderId_idx`(`tenantId`, `purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockTransfer` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `fromStoreId` VARCHAR(191) NOT NULL,
    `toStoreId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockTransfer_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockCount` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `previous` INTEGER NOT NULL,
    `counted` INTEGER NOT NULL,
    `difference` INTEGER NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockCount_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductMedia` ADD CONSTRAINT `ProductMedia_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductMedia` ADD CONSTRAINT `ProductMedia_tenantId_productId_fkey` FOREIGN KEY (`tenantId`, `productId`) REFERENCES `Product`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supplier` ADD CONSTRAINT `Supplier_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_tenantId_supplierId_fkey` FOREIGN KEY (`tenantId`, `supplierId`) REFERENCES `Supplier`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_tenantId_storeId_fkey` FOREIGN KEY (`tenantId`, `storeId`) REFERENCES `Store`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_tenantId_purchaseOrderId_fkey` FOREIGN KEY (`tenantId`, `purchaseOrderId`) REFERENCES `PurchaseOrder`(`tenantId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_tenantId_variantId_fkey` FOREIGN KEY (`tenantId`, `variantId`) REFERENCES `ProductVariant`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_tenantId_variantId_fkey` FOREIGN KEY (`tenantId`, `variantId`) REFERENCES `ProductVariant`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_tenantId_fromStoreId_fkey` FOREIGN KEY (`tenantId`, `fromStoreId`) REFERENCES `Store`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_tenantId_toStoreId_fkey` FOREIGN KEY (`tenantId`, `toStoreId`) REFERENCES `Store`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockCount` ADD CONSTRAINT `StockCount_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockCount` ADD CONSTRAINT `StockCount_tenantId_variantId_fkey` FOREIGN KEY (`tenantId`, `variantId`) REFERENCES `ProductVariant`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockCount` ADD CONSTRAINT `StockCount_tenantId_storeId_fkey` FOREIGN KEY (`tenantId`, `storeId`) REFERENCES `Store`(`tenantId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Store` ADD CONSTRAINT `Store_kind_check` CHECK (`kind` IN ('STORE', 'WAREHOUSE'));
ALTER TABLE `ProductMedia` ADD CONSTRAINT `ProductMedia_kind_check` CHECK (`kind` IN ('IMAGE', 'VIDEO') AND `position` >= 0);
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_status_check` CHECK (`status` IN ('DRAFT', 'RECEIVED', 'CANCELLED') AND `total` >= 0);
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_amount_check` CHECK (`quantity` > 0 AND `unitCost` >= 0);
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_quantity_check` CHECK (`quantity` > 0);
ALTER TABLE `StockCount` ADD CONSTRAINT `StockCount_quantity_check` CHECK (`previous` >= 0 AND `counted` >= 0 AND `difference` = `counted` - `previous`);
