-- 清除所有资金费数据
DELETE FROM "FundingFee";

-- 重置 Leg 的资金费相关字段
UPDATE "Leg" SET 
  "fundingFeeUsd" = 0,
  "netPnL" = "realisedPnLusd" - "commissionUsd",
  "fundingFeeUpdatedAt" = NULL;
