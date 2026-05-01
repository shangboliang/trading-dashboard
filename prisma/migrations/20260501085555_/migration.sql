-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "asynSyncCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAsynSyncAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AsyncSyncTask" (
    "id" SERIAL NOT NULL,
    "apiKeyId" INTEGER NOT NULL,
    "downloadId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "downloadUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsyncSyncTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AsyncSyncTask_downloadId_key" ON "AsyncSyncTask"("downloadId");

-- CreateIndex
CREATE INDEX "AsyncSyncTask_apiKeyId_idx" ON "AsyncSyncTask"("apiKeyId");

-- CreateIndex
CREATE INDEX "AsyncSyncTask_downloadId_idx" ON "AsyncSyncTask"("downloadId");

-- AddForeignKey
ALTER TABLE "AsyncSyncTask" ADD CONSTRAINT "AsyncSyncTask_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
