-- AlterTable
ALTER TABLE "TemplateQuestion" ADD COLUMN "dependsOnHeaderField" TEXT;
ALTER TABLE "TemplateQuestion" ADD COLUMN "dependsOnQuestionId" TEXT;
ALTER TABLE "TemplateQuestion" ADD COLUMN "dependsOnValue" TEXT;
