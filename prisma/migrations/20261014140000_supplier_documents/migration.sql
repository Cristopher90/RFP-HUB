-- AlterTable
ALTER TABLE "RfpTemplate" ADD COLUMN     "documentRequirements" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canManageSupplierDocs" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SupplierDocumentType" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hasDates" BOOLEAN NOT NULL DEFAULT false,
    "viewGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierDocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "supplierDirectoryId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "note" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierDocumentType_clientId_name_key" ON "SupplierDocumentType"("clientId", "name");

-- CreateIndex
CREATE INDEX "SupplierDocument_supplierDirectoryId_idx" ON "SupplierDocument"("supplierDirectoryId");

-- AddForeignKey
ALTER TABLE "SupplierDocumentType" ADD CONSTRAINT "SupplierDocumentType_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_supplierDirectoryId_fkey" FOREIGN KEY ("supplierDirectoryId") REFERENCES "SupplierDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "SupplierDocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierDocument" ADD CONSTRAINT "SupplierDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

