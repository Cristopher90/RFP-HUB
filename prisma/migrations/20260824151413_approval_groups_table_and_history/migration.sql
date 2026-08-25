/*
  Warnings:

  - You are about to drop the column `minRole` on the `ApprovalLevel` table. All the data in the column will be lost.
  - You are about to drop the column `minRole` on the `RfpApproval` table. All the data in the column will be lost.
  - You are about to drop the column `approvalGroupId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `approvalLimit` on the `User` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "UserApprovalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "approvalGroupId" TEXT NOT NULL,
    "limit" REAL NOT NULL,
    CONSTRAINT "UserApprovalGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserApprovalGroup_approvalGroupId_fkey" FOREIGN KEY ("approvalGroupId") REFERENCES "ApprovalGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApprovalLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "userIds" TEXT,
    "approvalGroupId" TEXT,
    "cumulative" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ApprovalLevel_approvalGroupId_fkey" FOREIGN KEY ("approvalGroupId") REFERENCES "ApprovalGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalLevel_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApprovalLevel" ("approvalGroupId", "cumulative", "id", "mode", "order", "stage", "userIds", "workflowId") SELECT "approvalGroupId", "cumulative", "id", "mode", "order", "stage", "userIds", "workflowId" FROM "ApprovalLevel";
DROP TABLE "ApprovalLevel";
ALTER TABLE "new_ApprovalLevel" RENAME TO "ApprovalLevel";
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
    "publishedAt" DATETIME,
    "closedAt" DATETIME,
    "hideResponsesUntilClosed" BOOLEAN NOT NULL DEFAULT false,
    "basedOnRfpId" TEXT,
    "scoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "awardCriteria" TEXT,
    "priceWeightPct" INTEGER,
    "awardedInvitationId" TEXT,
    "awardedAt" DATETIME,
    "pendingAwardInvitationId" TEXT,
    "approvalWorkflowId" TEXT,
    "appliedTemplates" TEXT,
    "createdByUserId" TEXT,
    CONSTRAINT "Rfp_basedOnRfpId_fkey" FOREIGN KEY ("basedOnRfpId") REFERENCES "Rfp" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Rfp_approvalWorkflowId_fkey" FOREIGN KEY ("approvalWorkflowId") REFERENCES "ApprovalWorkflow" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Rfp_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Rfp" ("appliedTemplates", "approvalWorkflowId", "awardCriteria", "awardedAt", "awardedInvitationId", "basedOnRfpId", "buyerName", "commodity", "createdAt", "createdByUserId", "deadlineAt", "description", "estimatedPrice", "id", "number", "origin", "pendingAwardInvitationId", "predecessorDocument", "priceWeightPct", "region", "scoringEnabled", "startDate", "status", "title", "updatedAt") SELECT "appliedTemplates", "approvalWorkflowId", "awardCriteria", "awardedAt", "awardedInvitationId", "basedOnRfpId", "buyerName", "commodity", "createdAt", "createdByUserId", "deadlineAt", "description", "estimatedPrice", "id", "number", "origin", "pendingAwardInvitationId", "predecessorDocument", "priceWeightPct", "region", "scoringEnabled", "startDate", "status", "title", "updatedAt" FROM "Rfp";
DROP TABLE "Rfp";
ALTER TABLE "new_Rfp" RENAME TO "Rfp";
CREATE UNIQUE INDEX "Rfp_number_key" ON "Rfp"("number");
CREATE TABLE "new_RfpApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rfpId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "userIds" TEXT,
    "approvalGroupId" TEXT,
    "cumulative" BOOLEAN NOT NULL DEFAULT false,
    "requiredValue" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" DATETIME,
    "lastReminderAt" DATETIME,
    CONSTRAINT "RfpApproval_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RfpApproval" ("approvalGroupId", "createdAt", "cumulative", "id", "mode", "order", "rejectedReason", "requiredValue", "rfpId", "stage", "status", "userIds") SELECT "approvalGroupId", "createdAt", "cumulative", "id", "mode", "order", "rejectedReason", "requiredValue", "rfpId", "stage", "status", "userIds" FROM "RfpApproval";
DROP TABLE "RfpApproval";
ALTER TABLE "new_RfpApproval" RENAME TO "RfpApproval";
CREATE UNIQUE INDEX "RfpApproval_rfpId_stage_order_key" ON "RfpApproval"("rfpId", "stage", "order");
CREATE TABLE "new_RfpTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "matchCommodity" TEXT,
    "matchRegion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "hideResponsesUntilClosed" BOOLEAN NOT NULL DEFAULT false,
    "approvalWorkflowId" TEXT,
    CONSTRAINT "RfpTemplate_approvalWorkflowId_fkey" FOREIGN KEY ("approvalWorkflowId") REFERENCES "ApprovalWorkflow" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RfpTemplate" ("active", "approvalWorkflowId", "createdAt", "description", "id", "matchCommodity", "matchRegion", "name", "updatedAt") SELECT "active", "approvalWorkflowId", "createdAt", "description", "id", "matchCommodity", "matchRegion", "name", "updatedAt" FROM "RfpTemplate";
DROP TABLE "RfpTemplate";
ALTER TABLE "new_RfpTemplate" RENAME TO "RfpTemplate";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lastName" TEXT,
    "client" TEXT,
    "email" TEXT NOT NULL,
    "companyCode" TEXT,
    "plant" TEXT,
    "costCenter" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'BUYER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("client", "companyCode", "costCenter", "createdAt", "email", "id", "lastName", "name", "passwordHash", "plant", "role") SELECT "client", "companyCode", "costCenter", "createdAt", "email", "id", "lastName", "name", "passwordHash", "plant", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UserApprovalGroup_userId_approvalGroupId_key" ON "UserApprovalGroup"("userId", "approvalGroupId");
