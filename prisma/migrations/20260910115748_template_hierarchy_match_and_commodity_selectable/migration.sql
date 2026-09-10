-- AlterTable
ALTER TABLE "Commodity" ADD COLUMN     "selectable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "RfpTemplate" ADD COLUMN     "matchCommodityIncludeDescendants" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "matchRegionIncludeDescendants" BOOLEAN NOT NULL DEFAULT false;
