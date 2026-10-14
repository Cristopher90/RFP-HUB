-- AlterTable
ALTER TABLE "User" ADD COLUMN     "modifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "User" SET "modifiedAt" = "createdAt";
