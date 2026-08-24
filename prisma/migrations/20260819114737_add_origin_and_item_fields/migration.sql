-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN "origin" TEXT;
ALTER TABLE "Rfp" ADD COLUMN "predecessorDocument" TEXT;

-- AlterTable
ALTER TABLE "RfpItem" ADD COLUMN "commodity" TEXT;
ALTER TABLE "RfpItem" ADD COLUMN "historicalPrice" REAL;

-- CreateTable
CREATE TABLE "Origin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Origin_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Origin" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Origin_code_key" ON "Origin"("code");
