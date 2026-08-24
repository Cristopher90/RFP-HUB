-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN "appliedTemplates" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RfpQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rfpId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPrerequisite" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'EXTERNAL',
    "respondedBy" TEXT NOT NULL DEFAULT 'SUPPLIER',
    "buyerAnswerValue" TEXT,
    "numberMin" REAL,
    "numberMax" REAL,
    "dependsOnQuestionId" TEXT,
    "dependsOnHeaderField" TEXT,
    "dependsOnValue" TEXT,
    "sourceTemplateQuestionId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RfpQuestion_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RfpQuestion" ("dependsOnHeaderField", "dependsOnQuestionId", "dependsOnValue", "id", "isPrerequisite", "locked", "options", "order", "required", "rfpId", "sourceTemplateQuestionId", "text", "type", "visibility", "weight") SELECT "dependsOnHeaderField", "dependsOnQuestionId", "dependsOnValue", "id", "isPrerequisite", "locked", "options", "order", "required", "rfpId", "sourceTemplateQuestionId", "text", "type", "visibility", "weight" FROM "RfpQuestion";
DROP TABLE "RfpQuestion";
ALTER TABLE "new_RfpQuestion" RENAME TO "RfpQuestion";
CREATE TABLE "new_TemplateQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isPrerequisite" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'EXTERNAL',
    "respondedBy" TEXT NOT NULL DEFAULT 'SUPPLIER',
    "numberMin" REAL,
    "numberMax" REAL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "lockMinRole" TEXT NOT NULL DEFAULT 'BUYER',
    "editableMinRole" TEXT NOT NULL DEFAULT 'BUYER',
    "dependsOnQuestionId" TEXT,
    "dependsOnHeaderField" TEXT,
    "dependsOnValue" TEXT,
    CONSTRAINT "TemplateQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RfpTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TemplateQuestion" ("dependsOnHeaderField", "dependsOnQuestionId", "dependsOnValue", "id", "isPrerequisite", "lockMinRole", "options", "order", "required", "templateId", "text", "type", "visibility", "weight") SELECT "dependsOnHeaderField", "dependsOnQuestionId", "dependsOnValue", "id", "isPrerequisite", "lockMinRole", "options", "order", "required", "templateId", "text", "type", "visibility", "weight" FROM "TemplateQuestion";
DROP TABLE "TemplateQuestion";
ALTER TABLE "new_TemplateQuestion" RENAME TO "TemplateQuestion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
