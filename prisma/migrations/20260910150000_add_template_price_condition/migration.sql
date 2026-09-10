-- CreateEnum
CREATE TYPE "TemplatePriceCondition" AS ENUM ('GREATER_THAN', 'LESS_THAN', 'BETWEEN');

-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN     "selectedTemplateId" TEXT;

-- AlterTable
ALTER TABLE "RfpTemplate" ADD COLUMN     "matchPriceCondition" "TemplatePriceCondition",
ADD COLUMN     "matchPriceMax" DOUBLE PRECISION,
ADD COLUMN     "matchPriceMin" DOUBLE PRECISION;
