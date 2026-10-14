-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

