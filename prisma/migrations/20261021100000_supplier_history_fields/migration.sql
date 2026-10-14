-- AlterEnum
ALTER TYPE "CustomFieldScope" ADD VALUE 'SUPPLIER';

-- AlterTable
ALTER TABLE "SupplierDirectory" ADD COLUMN     "commodity" TEXT,
ADD COLUMN     "initialBlock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "region" TEXT;

-- CreateTable
CREATE TABLE "SupplierEvent" (
    "id" TEXT NOT NULL,
    "supplierDirectoryId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierEvent_supplierDirectoryId_createdAt_idx" ON "SupplierEvent"("supplierDirectoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupplierEvent" ADD CONSTRAINT "SupplierEvent_supplierDirectoryId_fkey" FOREIGN KEY ("supplierDirectoryId") REFERENCES "SupplierDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierEvent" ADD CONSTRAINT "SupplierEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

