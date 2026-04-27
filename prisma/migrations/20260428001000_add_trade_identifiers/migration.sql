-- Add trade identifiers for stable dedup across CSV/API imports
ALTER TABLE "Trade"
ADD COLUMN "tradeId" TEXT,
ADD COLUMN "orderId" TEXT;

CREATE INDEX "Trade_tradeId_idx" ON "Trade"("tradeId");
CREATE INDEX "Trade_orderId_idx" ON "Trade"("orderId");
CREATE INDEX "Trade_apiKeyId_orderId_idx" ON "Trade"("apiKeyId", "orderId");
CREATE UNIQUE INDEX "Trade_apiKeyId_tradeId_key" ON "Trade"("apiKeyId", "tradeId");
