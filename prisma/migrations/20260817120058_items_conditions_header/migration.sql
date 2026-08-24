-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN "commodity" TEXT;
ALTER TABLE "Rfp" ADD COLUMN "estimatedPrice" REAL;
ALTER TABLE "Rfp" ADD COLUMN "region" TEXT;
ALTER TABLE "Rfp" ADD COLUMN "startDate" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RfpItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rfpId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "customFields" TEXT,
    CONSTRAINT "RfpItem_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RfpItem" ("description", "id", "name", "order", "quantity", "rfpId", "unit") SELECT "description", "id", "name", "order", "quantity", "rfpId", "unit" FROM "RfpItem";
DROP TABLE "RfpItem";
ALTER TABLE "new_RfpItem" RENAME TO "RfpItem";
CREATE TABLE "new_RfpQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rfpId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPrerequisite" BOOLEAN NOT NULL DEFAULT false,
    "dependsOnQuestionId" TEXT,
    "dependsOnHeaderField" TEXT,
    "dependsOnValue" TEXT,
    CONSTRAINT "RfpQuestion_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RfpQuestion" ("id", "options", "order", "required", "rfpId", "text", "type", "weight") SELECT "id", "options", "order", "required", "rfpId", "text", "type", "weight" FROM "RfpQuestion";
DROP TABLE "RfpQuestion";
ALTER TABLE "new_RfpQuestion" RENAME TO "RfpQuestion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
