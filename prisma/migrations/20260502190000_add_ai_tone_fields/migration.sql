-- AlterTable: Add defaultTone and customInstruction to AiConfig
ALTER TABLE "AiConfig" ADD COLUMN "defaultTone" TEXT NOT NULL DEFAULT 'objective';
ALTER TABLE "AiConfig" ADD COLUMN "customInstruction" TEXT;
