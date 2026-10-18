ALTER TABLE `MediaAsset`
  ADD COLUMN `storageDriver` VARCHAR(191) NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN `storageStatus` VARCHAR(191) NOT NULL DEFAULT 'READY',
  ADD COLUMN `uploadLeaseEndsAt` DATETIME(3) NULL;
CREATE INDEX `MediaAsset_storageStatus_uploadLeaseEndsAt_idx` ON `MediaAsset` (`storageStatus`, `uploadLeaseEndsAt`);
