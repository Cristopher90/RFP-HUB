-- AlterEnum
ALTER TYPE "CustomFieldScope" ADD VALUE 'REQUEST_HEAD';
ALTER TYPE "CustomFieldScope" ADD VALUE 'REQUEST_LINE';

-- AlterTable
ALTER TABLE "CustomField" ADD COLUMN "importable" BOOLEAN NOT NULL DEFAULT false;
