-- AlterTable
ALTER TABLE "SupplierUser" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City';
