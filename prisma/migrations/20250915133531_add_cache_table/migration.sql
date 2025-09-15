-- CreateTable
CREATE TABLE "Cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "originalKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "size" INTEGER NOT NULL,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccess" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttl" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Cache_cacheKey_key" ON "Cache"("cacheKey");

-- CreateIndex
CREATE INDEX "Cache_projectId_category_idx" ON "Cache"("projectId", "category");

-- CreateIndex
CREATE INDEX "Cache_lastAccess_idx" ON "Cache"("lastAccess");

-- CreateIndex
CREATE INDEX "Cache_ttl_idx" ON "Cache"("ttl");

-- CreateIndex
CREATE INDEX "Cache_accessCount_idx" ON "Cache"("accessCount");
