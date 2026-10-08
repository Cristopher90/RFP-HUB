-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canAssignRequests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canImportRequests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seeAllRequests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seeAssignedRequests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seeMyRequests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seeUnassignedRequests" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BuyerGroup" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BuyerGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestImportTemplate" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headerSheet" TEXT NOT NULL,
    "linesSheet" TEXT NOT NULL,
    "headerMapping" JSONB NOT NULL,
    "linesMapping" JSONB NOT NULL,
    "rfpMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestImportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "creator" TEXT,
    "requestDate" TIMESTAMP(3),
    "commodity" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedByUserId" TEXT,
    "templateId" TEXT,
    "assignedUserId" TEXT,
    "assignedGroupId" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "rfpId" TEXT,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "itemCode" TEXT,
    "description" TEXT NOT NULL,
    "historicalPrice" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "commodity" TEXT,

    CONSTRAINT "PurchaseRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuyerGroup_clientId_name_key" ON "BuyerGroup"("clientId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerGroupMember_groupId_userId_key" ON "BuyerGroupMember"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestImportTemplate_clientId_name_key" ON "RequestImportTemplate"("clientId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_rfpId_key" ON "PurchaseRequest"("rfpId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_clientId_importedAt_idx" ON "PurchaseRequest"("clientId", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_clientId_documentType_documentNumber_key" ON "PurchaseRequest"("clientId", "documentType", "documentNumber");

-- CreateIndex
CREATE INDEX "PurchaseRequestLine_requestId_idx" ON "PurchaseRequestLine"("requestId");

-- AddForeignKey
ALTER TABLE "BuyerGroup" ADD CONSTRAINT "BuyerGroup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerGroupMember" ADD CONSTRAINT "BuyerGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "BuyerGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerGroupMember" ADD CONSTRAINT "BuyerGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestImportTemplate" ADD CONSTRAINT "RequestImportTemplate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RequestImportTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_assignedGroupId_fkey" FOREIGN KEY ("assignedGroupId") REFERENCES "BuyerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
