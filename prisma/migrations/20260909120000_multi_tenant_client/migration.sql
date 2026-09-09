-- Multi-tenant "Cliente" rework: new Client master-data model, a
-- CLIENT_ADMIN role, and a clientId column on every table for per-client
-- data isolation. Existing data is backfilled into a single seed Client
-- ("Cliente Demo"); the existing admin@baseline.rfp user is left with a
-- NULL clientId, which is what makes an ADMIN a cross-client super user.

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CLIENT_ADMIN';

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- Seed the default client that all pre-existing rows are backfilled into
INSERT INTO "Client" ("id", "code", "description") VALUES ('client_demo_seed', 'DEMO', 'Cliente Demo');

-- AlterTable: User keeps the free-text "client" column removed, gains a
-- NULLABLE clientId — NULL is what makes a user a cross-client ADMIN.
ALTER TABLE "User" DROP COLUMN "client",
ADD COLUMN     "clientId" TEXT;

UPDATE "User" SET "clientId" = 'client_demo_seed' WHERE "email" <> 'admin@baseline.rfp';

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: UserApprovalGroup
ALTER TABLE "UserApprovalGroup" ADD COLUMN     "clientId" TEXT;
UPDATE "UserApprovalGroup" SET "clientId" = 'client_demo_seed';
ALTER TABLE "UserApprovalGroup" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "UserApprovalGroup" ADD CONSTRAINT "UserApprovalGroup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Commodity
ALTER TABLE "Commodity" ADD COLUMN     "clientId" TEXT;
UPDATE "Commodity" SET "clientId" = 'client_demo_seed';
ALTER TABLE "Commodity" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Commodity" ADD CONSTRAINT "Commodity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Region
ALTER TABLE "Region" ADD COLUMN     "clientId" TEXT;
UPDATE "Region" SET "clientId" = 'client_demo_seed';
ALTER TABLE "Region" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Region" ADD CONSTRAINT "Region_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Origin
ALTER TABLE "Origin" ADD COLUMN     "clientId" TEXT;
UPDATE "Origin" SET "clientId" = 'client_demo_seed';
ALTER TABLE "Origin" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Origin" ADD CONSTRAINT "Origin_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: ApprovalGroup
ALTER TABLE "ApprovalGroup" ADD COLUMN     "clientId" TEXT;
UPDATE "ApprovalGroup" SET "clientId" = 'client_demo_seed';
ALTER TABLE "ApprovalGroup" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "ApprovalGroup" ADD CONSTRAINT "ApprovalGroup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: SupplierDirectory
ALTER TABLE "SupplierDirectory" ADD COLUMN     "clientId" TEXT;
UPDATE "SupplierDirectory" SET "clientId" = 'client_demo_seed';
ALTER TABLE "SupplierDirectory" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "SupplierDirectory" ADD CONSTRAINT "SupplierDirectory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: ItemCatalogList
ALTER TABLE "ItemCatalogList" ADD COLUMN     "clientId" TEXT;
UPDATE "ItemCatalogList" SET "clientId" = 'client_demo_seed';
ALTER TABLE "ItemCatalogList" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "ItemCatalogList" ADD CONSTRAINT "ItemCatalogList_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: ItemCatalogEntry
ALTER TABLE "ItemCatalogEntry" ADD COLUMN     "clientId" TEXT;
UPDATE "ItemCatalogEntry" SET "clientId" = 'client_demo_seed';
ALTER TABLE "ItemCatalogEntry" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "ItemCatalogEntry" ADD CONSTRAINT "ItemCatalogEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: RfpTemplate
ALTER TABLE "RfpTemplate" ADD COLUMN     "clientId" TEXT;
UPDATE "RfpTemplate" SET "clientId" = 'client_demo_seed';
ALTER TABLE "RfpTemplate" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "RfpTemplate" ADD CONSTRAINT "RfpTemplate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: ApprovalWorkflow
ALTER TABLE "ApprovalWorkflow" ADD COLUMN     "clientId" TEXT;
UPDATE "ApprovalWorkflow" SET "clientId" = 'client_demo_seed';
ALTER TABLE "ApprovalWorkflow" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "ApprovalWorkflow" ADD CONSTRAINT "ApprovalWorkflow_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: ApprovalLevel
ALTER TABLE "ApprovalLevel" ADD COLUMN     "clientId" TEXT;
UPDATE "ApprovalLevel" SET "clientId" = 'client_demo_seed';
ALTER TABLE "ApprovalLevel" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "ApprovalLevel" ADD CONSTRAINT "ApprovalLevel_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: TemplateItem
ALTER TABLE "TemplateItem" ADD COLUMN     "clientId" TEXT;
UPDATE "TemplateItem" SET "clientId" = 'client_demo_seed';
ALTER TABLE "TemplateItem" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "TemplateItem" ADD CONSTRAINT "TemplateItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: TemplateQuestion
ALTER TABLE "TemplateQuestion" ADD COLUMN     "clientId" TEXT;
UPDATE "TemplateQuestion" SET "clientId" = 'client_demo_seed';
ALTER TABLE "TemplateQuestion" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "TemplateQuestion" ADD CONSTRAINT "TemplateQuestion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Rfp
ALTER TABLE "Rfp" ADD COLUMN     "clientId" TEXT;
UPDATE "Rfp" SET "clientId" = 'client_demo_seed';
ALTER TABLE "Rfp" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: RfpApproval
ALTER TABLE "RfpApproval" ADD COLUMN     "clientId" TEXT;
UPDATE "RfpApproval" SET "clientId" = 'client_demo_seed';
ALTER TABLE "RfpApproval" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "RfpApproval" ADD CONSTRAINT "RfpApproval_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: RfpApprovalDecision
ALTER TABLE "RfpApprovalDecision" ADD COLUMN     "clientId" TEXT;
UPDATE "RfpApprovalDecision" SET "clientId" = 'client_demo_seed';
ALTER TABLE "RfpApprovalDecision" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "RfpApprovalDecision" ADD CONSTRAINT "RfpApprovalDecision_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: RfpItem
ALTER TABLE "RfpItem" ADD COLUMN     "clientId" TEXT;
UPDATE "RfpItem" SET "clientId" = 'client_demo_seed';
ALTER TABLE "RfpItem" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "RfpItem" ADD CONSTRAINT "RfpItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: RfpQuestion
ALTER TABLE "RfpQuestion" ADD COLUMN     "clientId" TEXT;
UPDATE "RfpQuestion" SET "clientId" = 'client_demo_seed';
ALTER TABLE "RfpQuestion" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "RfpQuestion" ADD CONSTRAINT "RfpQuestion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Supplier
ALTER TABLE "Supplier" ADD COLUMN     "clientId" TEXT;
UPDATE "Supplier" SET "clientId" = 'client_demo_seed';
ALTER TABLE "Supplier" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Invitation
ALTER TABLE "Invitation" ADD COLUMN     "clientId" TEXT;
UPDATE "Invitation" SET "clientId" = 'client_demo_seed';
ALTER TABLE "Invitation" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Response
ALTER TABLE "Response" ADD COLUMN     "clientId" TEXT;
UPDATE "Response" SET "clientId" = 'client_demo_seed';
ALTER TABLE "Response" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Response" ADD CONSTRAINT "Response_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Answer
ALTER TABLE "Answer" ADD COLUMN     "clientId" TEXT;
UPDATE "Answer" SET "clientId" = 'client_demo_seed';
ALTER TABLE "Answer" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: ItemPrice
ALTER TABLE "ItemPrice" ADD COLUMN     "clientId" TEXT;
UPDATE "ItemPrice" SET "clientId" = 'client_demo_seed';
ALTER TABLE "ItemPrice" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "ItemPrice" ADD CONSTRAINT "ItemPrice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Composite uniqueness: code/name uniqueness now scoped per client

-- DropIndex
DROP INDEX "Commodity_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "Commodity_clientId_code_key" ON "Commodity"("clientId", "code");

-- DropIndex
DROP INDEX "Region_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "Region_clientId_code_key" ON "Region"("clientId", "code");

-- DropIndex
DROP INDEX "Origin_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "Origin_clientId_code_key" ON "Origin"("clientId", "code");

-- DropIndex
DROP INDEX "ApprovalGroup_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalGroup_clientId_code_key" ON "ApprovalGroup"("clientId", "code");

-- DropIndex
DROP INDEX "SupplierDirectory_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "SupplierDirectory_clientId_code_key" ON "SupplierDirectory"("clientId", "code");

-- DropIndex
DROP INDEX "ItemCatalogList_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "ItemCatalogList_clientId_name_key" ON "ItemCatalogList"("clientId", "name");

-- DropIndex
DROP INDEX "ItemCatalogEntry_catalogListId_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "ItemCatalogEntry_clientId_catalogListId_code_key" ON "ItemCatalogEntry"("clientId", "catalogListId", "code");
