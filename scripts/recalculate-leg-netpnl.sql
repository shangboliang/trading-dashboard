-- 重新计算所有 Leg 的 netPnL（应用新的资金费归集规则）
-- 规则：只有 Leg 已平仓 且 资金费在平仓后归集，才加上 fundingFeeUsd

UPDATE "Leg" SET 
  "netPnL" = CASE 
    -- closeDate 不为空 且 fundingFeeUpdatedAt > closeDate：加上资金费
    WHEN "closeDate" IS NOT NULL AND "fundingFeeUpdatedAt" IS NOT NULL AND "fundingFeeUpdatedAt" > "closeDate" 
      THEN "realisedPnLusd" - "commissionUsd" + "fundingFeeUsd"
    -- 其他情况：不加资金费
    ELSE "realisedPnLusd" - "commissionUsd"
  END;
