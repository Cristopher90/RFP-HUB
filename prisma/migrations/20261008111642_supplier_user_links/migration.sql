-- CreateEnum
CREATE TYPE "SupplierLinkStatus" AS ENUM ('PENDING_APPROVAL', 'SENT', 'ACCEPTED');

-- DropForeignKey
ALTER TABLE "SupplierUser" DROP CONSTRAINT "SupplierUser_clientId_fkey";

-- DropForeignKey
ALTER TABLE "SupplierUser" DROP CONSTRAINT "SupplierUser_supplierDirectoryId_fkey";

-- AlterTable
ALTER TABLE "SupplierUser" ALTER COLUMN "clientId" DROP NOT NULL,
ALTER COLUMN "supplierDirectoryId" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SupplierUserLink" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "supplierUserId" TEXT NOT NULL,
    "supplierDirectoryId" TEXT NOT NULL,
    "status" "SupplierLinkStatus" NOT NULL DEFAULT 'SENT',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "inviteToken" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierUserLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierUserLink_inviteToken_key" ON "SupplierUserLink"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierUserLink_supplierUserId_supplierDirectoryId_key" ON "SupplierUserLink"("supplierUserId", "supplierDirectoryId");

-- AddForeignKey
ALTER TABLE "SupplierUserLink" ADD CONSTRAINT "SupplierUserLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierUserLink" ADD CONSTRAINT "SupplierUserLink_supplierUserId_fkey" FOREIGN KEY ("supplierUserId") REFERENCES "SupplierUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierUserLink" ADD CONSTRAINT "SupplierUserLink_supplierDirectoryId_fkey" FOREIGN KEY ("supplierDirectoryId") REFERENCES "SupplierDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing portal users keep their access: one ACCEPTED link per account to
-- the supplier/client it already belonged to.
INSERT INTO "SupplierUserLink" ("id", "clientId", "supplierUserId", "supplierDirectoryId", "status", "isAdmin", "inviteToken", "invitedAt", "acceptedAt")
SELECT
  'sul_' || md5(random()::text || clock_timestamp()::text || u."id"),
  u."clientId",
  u."id",
  u."supplierDirectoryId",
  'ACCEPTED',
  false,
  md5(random()::text || clock_timestamp()::text || u."email"),
  u."createdAt",
  u."createdAt"
FROM "SupplierUser" u
WHERE u."clientId" IS NOT NULL AND u."supplierDirectoryId" IS NOT NULL;
