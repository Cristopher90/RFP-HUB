-- CreateTable
CREATE TABLE "Commodity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Rfp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "deadlineAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "commodity" TEXT,
    "region" TEXT,
    "startDate" DATETIME,
    "estimatedPrice" REAL,
    "awardCriteria" TEXT,
    "priceWeightPct" INTEGER,
    "awardedInvitationId" TEXT,
    "awardedAt" DATETIME,
    "appliedTemplates" TEXT,
    "createdByUserId" TEXT,
    CONSTRAINT "Rfp_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Rfp" ("appliedTemplates", "awardCriteria", "awardedAt", "awardedInvitationId", "buyerName", "commodity", "createdAt", "deadlineAt", "description", "estimatedPrice", "id", "priceWeightPct", "region", "startDate", "status", "title", "updatedAt") SELECT "appliedTemplates", "awardCriteria", "awardedAt", "awardedInvitationId", "buyerName", "commodity", "createdAt", "deadlineAt", "description", "estimatedPrice", "id", "priceWeightPct", "region", "startDate", "status", "title", "updatedAt" FROM "Rfp";
DROP TABLE "Rfp";
ALTER TABLE "new_Rfp" RENAME TO "Rfp";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Commodity_code_key" ON "Commodity"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");
