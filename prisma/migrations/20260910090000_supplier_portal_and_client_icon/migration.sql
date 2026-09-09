-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "supplierDirectoryId" TEXT;

-- CreateTable
CREATE TABLE "SupplierUser" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "supplierDirectoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierUser_email_key" ON "SupplierUser"("email");

-- AddForeignKey
ALTER TABLE "SupplierUser" ADD CONSTRAINT "SupplierUser_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierUser" ADD CONSTRAINT "SupplierUser_supplierDirectoryId_fkey" FOREIGN KEY ("supplierDirectoryId") REFERENCES "SupplierDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_supplierDirectoryId_fkey" FOREIGN KEY ("supplierDirectoryId") REFERENCES "SupplierDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

