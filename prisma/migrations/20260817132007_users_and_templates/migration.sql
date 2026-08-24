-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'BUYER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RfpTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "matchCommodity" TEXT,
    "matchRegion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TemplateItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "customFields" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "lockMinRole" TEXT NOT NULL DEFAULT 'BUYER',
    CONSTRAINT "TemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RfpTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemplateQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isPrerequisite" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "lockMinRole" TEXT NOT NULL DEFAULT 'BUYER',
    CONSTRAINT "TemplateQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RfpTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RfpItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rfpId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "customFields" TEXT,
    "sourceTemplateItemId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RfpItem_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RfpItem" ("customFields", "decimals", "description", "id", "name", "order", "quantity", "rfpId", "unit", "weight") SELECT "customFields", "decimals", "description", "id", "name", "order", "quantity", "rfpId", "unit", "weight" FROM "RfpItem";
DROP TABLE "RfpItem";
ALTER TABLE "new_RfpItem" RENAME TO "RfpItem";
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
    "dependsOnQuestionId" TEXT,
    "dependsOnHeaderField" TEXT,
    "dependsOnValue" TEXT,
    "sourceTemplateQuestionId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RfpQuestion_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RfpQuestion" ("dependsOnHeaderField", "dependsOnQuestionId", "dependsOnValue", "id", "isPrerequisite", "options", "order", "required", "rfpId", "text", "type", "weight") SELECT "dependsOnHeaderField", "dependsOnQuestionId", "dependsOnValue", "id", "isPrerequisite", "options", "order", "required", "rfpId", "text", "type", "weight" FROM "RfpQuestion";
DROP TABLE "RfpQuestion";
ALTER TABLE "new_RfpQuestion" RENAME TO "RfpQuestion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
