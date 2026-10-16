-- AlterTable
ALTER TABLE "SupplierUser" ADD COLUMN     "uiBackground" TEXT NOT NULL DEFAULT 'aurora',
ADD COLUMN     "uiGlass" INTEGER NOT NULL DEFAULT 17,
ADD COLUMN     "uiStyle" TEXT NOT NULL DEFAULT 'standard';
