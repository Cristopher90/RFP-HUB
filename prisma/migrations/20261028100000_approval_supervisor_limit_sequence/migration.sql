-- AlterEnum
ALTER TYPE "ApproverMode" ADD VALUE 'SUPERIOR';

-- AlterTable
ALTER TABLE "ApprovalWorkflow" ADD COLUMN     "appliesToAll" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 500;

-- AlterTable
ALTER TABLE "RfpApproval" ADD COLUMN     "viaSuperior" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workflowId" TEXT,
ADD COLUMN     "workflowName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "approvalLimit" DOUBLE PRECISION,
ADD COLUMN     "supervisorId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
