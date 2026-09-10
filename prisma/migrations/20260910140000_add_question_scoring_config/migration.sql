-- AlterTable
ALTER TABLE "RfpQuestion" ADD COLUMN     "scoringConfig" TEXT;

-- AlterTable
ALTER TABLE "TemplateItem" ALTER COLUMN "lockRoles" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TemplateQuestion" ADD COLUMN     "scoringConfig" TEXT,
ALTER COLUMN "lockRoles" DROP DEFAULT;
