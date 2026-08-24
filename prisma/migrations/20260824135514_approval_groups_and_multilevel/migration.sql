/*
  Warnings:

  - You are about to drop the column `awardApproverMode` on the `ApprovalWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `awardApproverUserIds` on the `ApprovalWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `awardMinRole` on the `ApprovalWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `awardRequired` on the `ApprovalWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `publishApproverMode` on the `ApprovalWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `publishApproverUserIds` on the `ApprovalWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `publishMinRole` on the `ApprovalWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `publishRequired` on the `ApprovalWorkflow` table. All the data in the column will be lost.
  - You are about to drop the column `awardApprovalState` on the `Rfp` table. All the data in the column will be lost.
  - You are about to drop the column `publishApprovalState` on the `Rfp` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "ApprovalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ApprovalGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "minRole" TEXT,
    "userIds" TEXT,
    "approvalGroupId" TEXT,
    "cumulative" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ApprovalLevel_approvalGroupId_fkey" FOREIGN KEY ("approvalGroupId") REFERENCES "ApprovalGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalLevel_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RfpApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rfpId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "minRole" TEXT,
    "userIds" TEXT,
    "approvalGroupId" TEXT,
    "cumulative" BOOLEAN NOT NULL DEFAULT false,
    "requiredValue" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RfpApproval_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RfpApprovalDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RfpApprovalDecision_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "RfpApproval" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RfpApprovalDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApprovalWorkflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ApprovalWorkflow" ("active", "createdAt", "description", "id", "name", "updatedAt") SELECT "active", "createdAt", "description", "id", "name", "updatedAt" FROM "ApprovalWorkflow";
DROP TABLE "ApprovalWorkflow";
ALTER TABLE "new_ApprovalWorkflow" RENAME TO "ApprovalWorkflow";
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvalLimit" REAL,
    "approvalGroupId" TEXT,
    CONSTRAINT "User_approvalGroupId_fkey" FOREIGN KEY ("approvalGroupId") REFERENCES "ApprovalGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("client", "companyCode", "costCenter", "createdAt", "email", "id", "lastName", "name", "passwordHash", "plant", "role") SELECT "client", "companyCode", "costCenter", "createdAt", "email", "id", "lastName", "name", "passwordHash", "plant", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalGroup_code_key" ON "ApprovalGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RfpApproval_rfpId_stage_order_key" ON "RfpApproval"("rfpId", "stage", "order");
