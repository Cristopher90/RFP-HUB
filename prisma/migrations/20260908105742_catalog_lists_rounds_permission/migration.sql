-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allowFreeTextItems" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN     "roundNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "seriesRootId" TEXT;

-- AlterTable
ALTER TABLE "RfpItem" ADD COLUMN     "sourceItemCatalogEntryId" TEXT;

-- DropTable
DROP TABLE "ItemCatalog";

-- CreateTable
CREATE TABLE "ItemCatalogList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemCatalogList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCatalogEntry" (
    "id" TEXT NOT NULL,
    "catalogListId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "commodity" TEXT,
    "lastPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemCatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemCatalogList_name_key" ON "ItemCatalogList"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCatalogEntry_catalogListId_code_key" ON "ItemCatalogEntry"("catalogListId", "code");

-- AddForeignKey
ALTER TABLE "ItemCatalogEntry" ADD CONSTRAINT "ItemCatalogEntry_catalogListId_fkey" FOREIGN KEY ("catalogListId") REFERENCES "ItemCatalogList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfp" ADD CONSTRAINT "Rfp_seriesRootId_fkey" FOREIGN KEY ("seriesRootId") REFERENCES "Rfp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

