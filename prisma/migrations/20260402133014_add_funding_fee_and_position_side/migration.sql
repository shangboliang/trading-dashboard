-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'PREMIUM');

-- CreateEnum
CREATE TYPE "Exchange" AS ENUM ('BINANCE', 'OKX', 'BYBIT', 'HUOBI', 'GATEIO', 'KUCOIN');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT', 'STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT');

-- CreateEnum
CREATE TYPE "LegSide" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "LegStatus" AS ENUM ('OPEN', 'CLOSED', 'PARTIALLY_CLOSED', 'LIQUIDATED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "defaultTimeframe" TEXT NOT NULL DEFAULT '30d',
    "currency" TEXT NOT NULL DEFAULT 'USDT',
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "enableEmailNotify" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" "Exchange" NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "passphrase" TEXT,
    "permissions" JSONB,
    "ipWhitelist" TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "apiKeyId" INTEGER NOT NULL,
    "legId" INTEGER,
    "symbol" TEXT NOT NULL,
    "baseAsset" TEXT NOT NULL DEFAULT '',
    "quoteAsset" TEXT NOT NULL DEFAULT '',
    "side" "TradeSide" NOT NULL,
    "positionSide" TEXT NOT NULL DEFAULT 'BOTH',
    "type" "OrderType",
    "price" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "quoteAmount" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,
    "feeAsset" TEXT NOT NULL,
    "feeUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "tradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leg" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "symbol" TEXT NOT NULL,
    "baseAsset" TEXT NOT NULL DEFAULT '',
    "quoteAsset" TEXT NOT NULL DEFAULT '',
    "side" "LegSide" NOT NULL,
    "openDate" TIMESTAMP(3) NOT NULL,
    "openPrice" DOUBLE PRECISION NOT NULL,
    "closeDate" TIMESTAMP(3),
    "closePrice" DOUBLE PRECISION,
    "status" "LegStatus" NOT NULL DEFAULT 'OPEN',
    "openAmount" DOUBLE PRECISION NOT NULL,
    "closeAmount" DOUBLE PRECISION,
    "currentAmount" DOUBLE PRECISION NOT NULL,
    "averageEntry" DOUBLE PRECISION NOT NULL,
    "averageExit" DOUBLE PRECISION,
    "realisedPnL" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "realisedPnLusd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unrealisedPnL" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPnL" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fundingFeeUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sizeUsd" DOUBLE PRECISION NOT NULL,
    "peakSizeUsd" DOUBLE PRECISION,
    "duration" INTEGER,
    "mae" DOUBLE PRECISION,
    "mfe" DOUBLE PRECISION,
    "entryQuality" DOUBLE PRECISION,
    "exitQuality" DOUBLE PRECISION,
    "notes" TEXT,
    "strategy" TEXT,
    "setup" TEXT,
    "mistakes" TEXT,
    "snapshotData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" INTEGER,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "description" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "apiKeyId" INTEGER NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "tradesFound" INTEGER NOT NULL DEFAULT 0,
    "tradesImported" INTEGER NOT NULL DEFAULT 0,
    "legsCreated" INTEGER NOT NULL DEFAULT 0,
    "legsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingFee" (
    "id" SERIAL NOT NULL,
    "apiKeyId" INTEGER NOT NULL,
    "legId" INTEGER,
    "symbol" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LegTags" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_uuid_key" ON "User"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "UserSettings_userId_idx" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_uuid_key" ON "ApiKey"("uuid");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_exchange_idx" ON "ApiKey"("exchange");

-- CreateIndex
CREATE INDEX "ApiKey_isVerified_idx" ON "ApiKey"("isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_uuid_key" ON "Trade"("uuid");

-- CreateIndex
CREATE INDEX "Trade_apiKeyId_idx" ON "Trade"("apiKeyId");

-- CreateIndex
CREATE INDEX "Trade_legId_idx" ON "Trade"("legId");

-- CreateIndex
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");

-- CreateIndex
CREATE INDEX "Trade_timestamp_idx" ON "Trade"("timestamp");

-- CreateIndex
CREATE INDEX "Trade_side_idx" ON "Trade"("side");

-- CreateIndex
CREATE UNIQUE INDEX "Leg_uuid_key" ON "Leg"("uuid");

-- CreateIndex
CREATE INDEX "Leg_userId_idx" ON "Leg"("userId");

-- CreateIndex
CREATE INDEX "Leg_symbol_idx" ON "Leg"("symbol");

-- CreateIndex
CREATE INDEX "Leg_status_idx" ON "Leg"("status");

-- CreateIndex
CREATE INDEX "Leg_openDate_idx" ON "Leg"("openDate");

-- CreateIndex
CREATE INDEX "Leg_closeDate_idx" ON "Leg"("closeDate");

-- CreateIndex
CREATE INDEX "Leg_side_idx" ON "Leg"("side");

-- CreateIndex
CREATE INDEX "Leg_netPnL_idx" ON "Leg"("netPnL");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_uuid_key" ON "Tag"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_userId_idx" ON "Tag"("userId");

-- CreateIndex
CREATE INDEX "Tag_slug_idx" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SyncLog_uuid_key" ON "SyncLog"("uuid");

-- CreateIndex
CREATE INDEX "SyncLog_apiKeyId_idx" ON "SyncLog"("apiKeyId");

-- CreateIndex
CREATE INDEX "SyncLog_status_idx" ON "SyncLog"("status");

-- CreateIndex
CREATE INDEX "SyncLog_startTime_idx" ON "SyncLog"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_key_idx" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "FundingFee_apiKeyId_idx" ON "FundingFee"("apiKeyId");

-- CreateIndex
CREATE INDEX "FundingFee_legId_idx" ON "FundingFee"("legId");

-- CreateIndex
CREATE INDEX "FundingFee_symbol_idx" ON "FundingFee"("symbol");

-- CreateIndex
CREATE INDEX "FundingFee_timestamp_idx" ON "FundingFee"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "FundingFee_apiKeyId_symbol_timestamp_key" ON "FundingFee"("apiKeyId", "symbol", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "_LegTags_AB_unique" ON "_LegTags"("A", "B");

-- CreateIndex
CREATE INDEX "_LegTags_B_index" ON "_LegTags"("B");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_legId_fkey" FOREIGN KEY ("legId") REFERENCES "Leg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leg" ADD CONSTRAINT "Leg_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingFee" ADD CONSTRAINT "FundingFee_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingFee" ADD CONSTRAINT "FundingFee_legId_fkey" FOREIGN KEY ("legId") REFERENCES "Leg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LegTags" ADD CONSTRAINT "_LegTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Leg"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LegTags" ADD CONSTRAINT "_LegTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
