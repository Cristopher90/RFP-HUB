-- AlterTable
ALTER TABLE "SupplierUser" ADD COLUMN     "colorMode" TEXT NOT NULL DEFAULT 'light',
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'violet';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "colorMode" TEXT NOT NULL DEFAULT 'light',
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'violet';
