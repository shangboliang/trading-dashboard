-- AlterTable: Add temperature and maxTokens to AiConfig
ALTER TABLE "AiConfig" ADD COLUMN "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7;
ALTER TABLE "AiConfig" ADD COLUMN "maxTokens" INTEGER NOT NULL DEFAULT 4096;
