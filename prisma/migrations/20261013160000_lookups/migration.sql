-- AlterTable
ALTER TABLE "CustomField" ADD COLUMN     "lookupId" TEXT,
ADD COLUMN     "viewGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Lookup" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lookup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LookupValue" (
    "id" TEXT NOT NULL,
    "lookupId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "parentId" TEXT,
    "viewGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LookupValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lookup_clientId_name_key" ON "Lookup"("clientId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LookupValue_lookupId_code_key" ON "LookupValue"("lookupId", "code");

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_lookupId_fkey" FOREIGN KEY ("lookupId") REFERENCES "Lookup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lookup" ADD CONSTRAINT "Lookup_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LookupValue" ADD CONSTRAINT "LookupValue_lookupId_fkey" FOREIGN KEY ("lookupId") REFERENCES "Lookup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LookupValue" ADD CONSTRAINT "LookupValue_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LookupValue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

