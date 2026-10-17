-- CreateTable
CREATE TABLE "_TemplateWorkflows" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TemplateWorkflows_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TemplateWorkflows_B_index" ON "_TemplateWorkflows"("B");

-- AddForeignKey
ALTER TABLE "_TemplateWorkflows" ADD CONSTRAINT "_TemplateWorkflows_A_fkey" FOREIGN KEY ("A") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TemplateWorkflows" ADD CONSTRAINT "_TemplateWorkflows_B_fkey" FOREIGN KEY ("B") REFERENCES "RfpTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the existing assignments (one workflow per template until now).
INSERT INTO "_TemplateWorkflows" ("A", "B")
SELECT "approvalWorkflowId", "id" FROM "RfpTemplate" WHERE "approvalWorkflowId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "RfpTemplate" DROP CONSTRAINT "RfpTemplate_approvalWorkflowId_fkey";

-- AlterTable
ALTER TABLE "RfpTemplate" DROP COLUMN "approvalWorkflowId";
