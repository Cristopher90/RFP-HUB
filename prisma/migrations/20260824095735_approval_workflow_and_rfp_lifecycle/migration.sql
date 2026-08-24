/*
  Warnings:

  - Added the required column `number` to the `Rfp` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishRequired" BOOLEAN NOT NULL DEFAULT true,
    "publishApproverMode" TEXT NOT NULL DEFAULT 'ROLE',
    "publishMinRole" TEXT NOT NULL DEFAULT 'SENIOR_BUYER',
    "publishApproverUserIds" TEXT,
    "awardRequired" BOOLEAN NOT NULL DEFAULT true,
    "awardApproverMode" TEXT NOT NULL DEFAULT 'ROLE',
    "awardMinRole" TEXT NOT NULL DEFAULT 'SENIOR_BUYER',
    "awardApproverUserIds" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Rfp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
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
    "origin" TEXT,
    "predecessorDocument" TEXT,
    "basedOnRfpId" TEXT,
    "scoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "awardCriteria" TEXT,
    "priceWeightPct" INTEGER,
    "awardedInvitationId" TEXT,
    "awardedAt" DATETIME,
    "pendingAwardInvitationId" TEXT,
    "approvalWorkflowId" TEXT,
    "publishApprovalState" TEXT,
    "awardApprovalState" TEXT,
    "appliedTemplates" TEXT,
    "createdByUserId" TEXT,
    CONSTRAINT "Rfp_basedOnRfpId_fkey" FOREIGN KEY ("basedOnRfpId") REFERENCES "Rfp" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Rfp_approvalWorkflowId_fkey" FOREIGN KEY ("approvalWorkflowId") REFERENCES "ApprovalWorkflow" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Rfp_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Rfp" ("appliedTemplates", "awardCriteria", "awardedAt", "awardedInvitationId", "buyerName", "commodity", "createdAt", "createdByUserId", "deadlineAt", "description", "estimatedPrice", "id", "origin", "predecessorDocument", "priceWeightPct", "region", "startDate", "status", "title", "updatedAt") SELECT "appliedTemplates", "awardCriteria", "awardedAt", "awardedInvitationId", "buyerName", "commodity", "createdAt", "createdByUserId", "deadlineAt", "description", "estimatedPrice", "id", "origin", "predecessorDocument", "priceWeightPct", "region", "startDate", "status", "title", "updatedAt" FROM "Rfp";
DROP TABLE "Rfp";
ALTER TABLE "new_Rfp" RENAME TO "Rfp";
CREATE UNIQUE INDEX "Rfp_number_key" ON "Rfp"("number");
CREATE TABLE "new_RfpTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "matchCommodity" TEXT,
    "matchRegion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "approvalWorkflowId" TEXT,
    CONSTRAINT "RfpTemplate_approvalWorkflowId_fkey" FOREIGN KEY ("approvalWorkflowId") REFERENCES "ApprovalWorkflow" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RfpTemplate" ("active", "createdAt", "description", "id", "matchCommodity", "matchRegion", "name", "updatedAt") SELECT "active", "createdAt", "description", "id", "matchCommodity", "matchRegion", "name", "updatedAt" FROM "RfpTemplate";
DROP TABLE "RfpTemplate";
ALTER TABLE "new_RfpTemplate" RENAME TO "RfpTemplate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
