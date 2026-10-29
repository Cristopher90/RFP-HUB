-- CreateEnum
CREATE TYPE "RfpKind" AS ENUM ('RFP', 'RFI');

-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN     "kind" "RfpKind" NOT NULL DEFAULT 'RFP';

-- AlterTable
ALTER TABLE "RfpTemplate" ADD COLUMN     "matchKind" "RfpKind";
