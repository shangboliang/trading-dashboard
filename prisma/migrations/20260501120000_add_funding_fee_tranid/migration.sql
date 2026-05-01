-- AlterTable: Add new columns to FundingFee
ALTER TABLE "FundingFee" ADD COLUMN IF NOT EXISTS "tranId" TEXT;
ALTER TABLE "FundingFee" ADD COLUMN IF NOT EXISTS "incomeType" TEXT NOT NULL DEFAULT 'FUNDING_FEE';
ALTER TABLE "FundingFee" ADD COLUMN IF NOT EXISTS "asset" TEXT NOT NULL DEFAULT 'USDT';
ALTER TABLE "FundingFee" ADD COLUMN IF NOT EXISTS "info" TEXT;

-- Drop old unique constraint (try different possible names)
DO $$
BEGIN
  -- Try to drop the constraint with different possible names
  BEGIN ALTER TABLE "FundingFee" DROP CONSTRAINT "FundingFee_apiKeyId_symbol_timestamp_key"; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN ALTER TABLE "FundingFee" DROP CONSTRAINT "FundingFee_apiKeyId_symbol_timestamp_idx"; EXCEPTION WHEN undefined_object THEN NULL; END;
  -- Also try dropping the index directly
  BEGIN DROP INDEX IF EXISTS "FundingFee_apiKeyId_symbol_timestamp_key"; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP INDEX IF EXISTS "FundingFee_apiKeyId_symbol_timestamp_idx"; EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

-- Create new unique constraint on (apiKeyId, tranId, incomeType)
-- Only create if tranId is not null (since tranId can be NULL)
CREATE UNIQUE INDEX "FundingFee_apiKeyId_tranId_incomeType_key" ON "FundingFee"("apiKeyId", "tranId", "incomeType") WHERE "tranId" IS NOT NULL;

-- Create index on tranId for faster lookups
CREATE INDEX IF NOT EXISTS "FundingFee_tranId_idx" ON "FundingFee"("tranId");
