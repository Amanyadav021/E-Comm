BEGIN TRY

BEGIN TRAN;

-- DropIndex
ALTER TABLE [dbo].[Order] DROP CONSTRAINT [Order_idempotencyKey_key];

-- DropIndex
ALTER TABLE [dbo].[Payment] DROP CONSTRAINT [Payment_providerPaymentId_key];

-- DropIndex
ALTER TABLE [dbo].[User] DROP CONSTRAINT [User_email_key];

-- DropIndex
ALTER TABLE [dbo].[User] DROP CONSTRAINT [User_googleId_key];

-- DropIndex
ALTER TABLE [dbo].[User] DROP CONSTRAINT [User_phone_key];

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_idempotencyKey_idx] ON [dbo].[Order]([idempotencyKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payment_providerOrderId_idx] ON [dbo].[Payment]([providerOrderId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_email_idx] ON [dbo].[User]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_phone_idx] ON [dbo].[User]([phone]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_googleId_idx] ON [dbo].[User]([googleId]);

-- Custom: FILTERED unique indexes — SQL Server unique constraints allow only
-- one NULL, so uniqueness for nullable columns is enforced only on non-NULL
-- values. The API treats these columns as unique (duplicate inserts fail).
CREATE UNIQUE NONCLUSTERED INDEX [User_email_unique] ON [dbo].[User]([email]) WHERE [email] IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX [User_phone_unique] ON [dbo].[User]([phone]) WHERE [phone] IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX [User_googleId_unique] ON [dbo].[User]([googleId]) WHERE [googleId] IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX [Payment_providerPaymentId_unique] ON [dbo].[Payment]([providerPaymentId]) WHERE [providerPaymentId] IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX [Order_idempotencyKey_unique] ON [dbo].[Order]([idempotencyKey]) WHERE [idempotencyKey] IS NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
