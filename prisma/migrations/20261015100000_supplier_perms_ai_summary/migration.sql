-- AlterTable
ALTER TABLE "SupplierDirectory" ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "aiSummaryAt" TIMESTAMP(3),
ADD COLUMN     "aiSummaryKey" TEXT,
ADD COLUMN     "aiSummaryModel" TEXT,
ADD COLUMN     "aiSummarySources" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canAddSupplierContacts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCreateSuppliers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canEditSuppliers" BOOLEAN NOT NULL DEFAULT false;

