-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AiProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('GENERATING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "AiConfig" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT,
    "modelName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiReport" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "aiConfigId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "filters" JSONB,
    "csvData" TEXT NOT NULL,
    "promptUsed" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "status" "ReportStatus" NOT NULL DEFAULT 'GENERATING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiConfig_uuid_key" ON "AiConfig"("uuid");

-- CreateIndex
CREATE INDEX "AiConfig_userId_idx" ON "AiConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiReport_uuid_key" ON "AiReport"("uuid");

-- CreateIndex
CREATE INDEX "AiReport_userId_idx" ON "AiReport"("userId");

-- CreateIndex
CREATE INDEX "AiReport_status_idx" ON "AiReport"("status");

-- CreateIndex
CREATE INDEX "AiReport_createdAt_idx" ON "AiReport"("createdAt");

-- AddForeignKey
ALTER TABLE "AiConfig" ADD CONSTRAINT "AiConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReport" ADD CONSTRAINT "AiReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiReport" ADD CONSTRAINT "AiReport_aiConfigId_fkey" FOREIGN KEY ("aiConfigId") REFERENCES "AiConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
