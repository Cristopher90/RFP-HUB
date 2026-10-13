-- AlterTable
ALTER TABLE "Commodity" ADD COLUMN     "viewGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Region" ADD COLUMN     "viewGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "RfpTemplate" ADD COLUMN     "viewGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SupplierDirectory" ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "viewGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SupplierUserLink" ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canBlockSuppliers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canRateSuppliers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ViewGroup" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierRating" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "supplierDirectoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ViewGroup_clientId_name_key" ON "ViewGroup"("clientId", "name");

-- CreateIndex
CREATE INDEX "SupplierRating_clientId_idx" ON "SupplierRating"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierRating_supplierDirectoryId_userId_key" ON "SupplierRating"("supplierDirectoryId", "userId");

-- AddForeignKey
ALTER TABLE "ViewGroup" ADD CONSTRAINT "ViewGroup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRating" ADD CONSTRAINT "SupplierRating_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRating" ADD CONSTRAINT "SupplierRating_supplierDirectoryId_fkey" FOREIGN KEY ("supplierDirectoryId") REFERENCES "SupplierDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRating" ADD CONSTRAINT "SupplierRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

