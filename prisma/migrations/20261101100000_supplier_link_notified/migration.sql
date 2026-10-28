-- AlterTable
ALTER TABLE "SupplierUserLink" ADD COLUMN     "notifiedAt" TIMESTAMP(3);

-- Invitations already sent before this column existed.
UPDATE "SupplierUserLink" SET "notifiedAt" = "invitedAt" WHERE "status" IN ('SENT', 'ACCEPTED');
