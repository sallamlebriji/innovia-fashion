ALTER TABLE `SubscriptionInvoice` ADD COLUMN `checkoutRequestedAt` DATETIME(3) NULL;
ALTER TABLE `RecurringBilling` ADD COLUMN `checkoutRequestedAt` DATETIME(3) NULL;
