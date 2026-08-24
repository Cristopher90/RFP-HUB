-- AlterTable
ALTER TABLE "Answer" ADD COLUMN "score" INTEGER;

-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN "awardCriteria" TEXT;
ALTER TABLE "Rfp" ADD COLUMN "awardedAt" DATETIME;
ALTER TABLE "Rfp" ADD COLUMN "awardedInvitationId" TEXT;
ALTER TABLE "Rfp" ADD COLUMN "priceWeightPct" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RfpQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rfpId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RfpQuestion_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RfpQuestion" ("id", "options", "order", "required", "rfpId", "text", "type") SELECT "id", "options", "order", "required", "rfpId", "text", "type" FROM "RfpQuestion";
DROP TABLE "RfpQuestion";
ALTER TABLE "new_RfpQuestion" RENAME TO "RfpQuestion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
