-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RfpStatus" AS ENUM ('DRAFT', 'PENDING_PUBLISH_APPROVAL', 'OPEN', 'CLOSED', 'DELETED');

-- CreateEnum
CREATE TYPE "ApproverMode" AS ENUM ('USERS', 'GROUP');

-- CreateEnum
CREATE TYPE "ApprovalStageKind" AS ENUM ('PUBLISH', 'AWARD');

-- CreateEnum
CREATE TYPE "RfpApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'MONEY', 'ATTACHMENT', 'YES_NO');

-- CreateEnum
CREATE TYPE "QuestionResponder" AS ENUM ('SUPPLIER', 'BUYER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('INVITED', 'VIEWED', 'RESPONDED');

-- CreateEnum
CREATE TYPE "QuestionVisibility" AS ENUM ('INTERNAL', 'SUPPLIER_ONLY', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUYER', 'SENIOR_BUYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SupplierDirectoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT,
    "client" TEXT,
    "email" TEXT NOT NULL,
    "companyCode" TEXT,
    "plant" TEXT,
    "costCenter" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BUYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserApprovalGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "approvalGroupId" TEXT NOT NULL,
    "limit" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "UserApprovalGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commodity" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commodity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Origin" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Origin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierDirectory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactFirstName" TEXT NOT NULL,
    "contactLastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "SupplierDirectoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfpTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "matchCommodity" TEXT,
    "matchRegion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hideResponsesUntilClosed" BOOLEAN NOT NULL DEFAULT false,
    "approvalWorkflowId" TEXT,

    CONSTRAINT "RfpTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalLevel" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "stage" "ApprovalStageKind" NOT NULL,
    "order" INTEGER NOT NULL,
    "mode" "ApproverMode" NOT NULL,
    "userIds" TEXT,
    "approvalGroupId" TEXT,
    "cumulative" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ApprovalLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "customFields" TEXT,
    "section" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "lockMinRole" "UserRole" NOT NULL DEFAULT 'BUYER',

    CONSTRAINT "TemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateQuestion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isPrerequisite" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "QuestionVisibility" NOT NULL DEFAULT 'EXTERNAL',
    "respondedBy" "QuestionResponder" NOT NULL DEFAULT 'SUPPLIER',
    "numberMin" DOUBLE PRECISION,
    "numberMax" DOUBLE PRECISION,
    "section" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "lockMinRole" "UserRole" NOT NULL DEFAULT 'BUYER',
    "dependsOnQuestionId" TEXT,
    "dependsOnHeaderField" TEXT,
    "dependsOnValue" TEXT,

    CONSTRAINT "TemplateQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rfp" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "status" "RfpStatus" NOT NULL DEFAULT 'OPEN',
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "commodity" TEXT,
    "region" TEXT,
    "startDate" TIMESTAMP(3),
    "estimatedPrice" DOUBLE PRECISION,
    "origin" TEXT,
    "predecessorDocument" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "hideResponsesUntilClosed" BOOLEAN NOT NULL DEFAULT false,
    "basedOnRfpId" TEXT,
    "scoringEnabled" BOOLEAN NOT NULL DEFAULT true,
    "awardCriteria" TEXT,
    "priceWeightPct" INTEGER,
    "awardedInvitationId" TEXT,
    "awardedAt" TIMESTAMP(3),
    "pendingAwardInvitationId" TEXT,
    "approvalWorkflowId" TEXT,
    "appliedTemplates" TEXT,
    "createdByUserId" TEXT,

    CONSTRAINT "Rfp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfpApproval" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "stage" "ApprovalStageKind" NOT NULL,
    "order" INTEGER NOT NULL,
    "mode" "ApproverMode" NOT NULL,
    "userIds" TEXT,
    "approvalGroupId" TEXT,
    "cumulative" BOOLEAN NOT NULL DEFAULT false,
    "requiredValue" DOUBLE PRECISION NOT NULL,
    "status" "RfpApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "lastReminderAt" TIMESTAMP(3),

    CONSTRAINT "RfpApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfpApprovalDecision" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfpApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfpItem" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "historicalPrice" DOUBLE PRECISION,
    "commodity" TEXT,
    "customFields" TEXT,
    "section" TEXT,
    "sourceTemplateItemId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RfpItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfpQuestion" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPrerequisite" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "QuestionVisibility" NOT NULL DEFAULT 'EXTERNAL',
    "respondedBy" "QuestionResponder" NOT NULL DEFAULT 'SUPPLIER',
    "buyerAnswerValue" TEXT,
    "numberMin" DOUBLE PRECISION,
    "numberMax" DOUBLE PRECISION,
    "dependsOnQuestionId" TEXT,
    "dependsOnHeaderField" TEXT,
    "dependsOnValue" TEXT,
    "section" TEXT,
    "sourceTemplateQuestionId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RfpQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "score" INTEGER,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPrice" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ItemPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserApprovalGroup_userId_approvalGroupId_key" ON "UserApprovalGroup"("userId", "approvalGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Commodity_code_key" ON "Commodity"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Origin_code_key" ON "Origin"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalGroup_code_key" ON "ApprovalGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierDirectory_code_key" ON "SupplierDirectory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Rfp_number_key" ON "Rfp"("number");

-- CreateIndex
CREATE UNIQUE INDEX "RfpApproval_rfpId_stage_order_key" ON "RfpApproval"("rfpId", "stage", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_rfpId_supplierId_key" ON "Invitation"("rfpId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_invitationId_key" ON "Response"("invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_responseId_questionId_key" ON "Answer"("responseId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPrice_responseId_itemId_key" ON "ItemPrice"("responseId", "itemId");

-- AddForeignKey
ALTER TABLE "UserApprovalGroup" ADD CONSTRAINT "UserApprovalGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserApprovalGroup" ADD CONSTRAINT "UserApprovalGroup_approvalGroupId_fkey" FOREIGN KEY ("approvalGroupId") REFERENCES "ApprovalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commodity" ADD CONSTRAINT "Commodity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Commodity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Origin" ADD CONSTRAINT "Origin_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Origin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalGroup" ADD CONSTRAINT "ApprovalGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ApprovalGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpTemplate" ADD CONSTRAINT "RfpTemplate_approvalWorkflowId_fkey" FOREIGN KEY ("approvalWorkflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLevel" ADD CONSTRAINT "ApprovalLevel_approvalGroupId_fkey" FOREIGN KEY ("approvalGroupId") REFERENCES "ApprovalGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLevel" ADD CONSTRAINT "ApprovalLevel_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateItem" ADD CONSTRAINT "TemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RfpTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateQuestion" ADD CONSTRAINT "TemplateQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RfpTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_basedOnRfpId_fkey" FOREIGN KEY ("basedOnRfpId") REFERENCES "Rfp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_approvalWorkflowId_fkey" FOREIGN KEY ("approvalWorkflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpApproval" ADD CONSTRAINT "RfpApproval_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpApprovalDecision" ADD CONSTRAINT "RfpApprovalDecision_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "RfpApproval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpApprovalDecision" ADD CONSTRAINT "RfpApprovalDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpItem" ADD CONSTRAINT "RfpItem_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpQuestion" ADD CONSTRAINT "RfpQuestion_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "RfpQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPrice" ADD CONSTRAINT "ItemPrice_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPrice" ADD CONSTRAINT "ItemPrice_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RfpItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

