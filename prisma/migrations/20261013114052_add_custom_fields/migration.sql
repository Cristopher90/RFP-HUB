-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TREE', 'TEXT', 'TEXT_SHORT', 'NUMBER', 'DROPDOWN', 'AMOUNT', 'CHECKBOX');

-- CreateEnum
CREATE TYPE "CustomFieldScope" AS ENUM ('RFP_HEAD', 'RFP_LINE', 'USER');

-- AlterTable
ALTER TABLE "RfpTemplate" ADD COLUMN     "matchCustom" JSONB;

-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" "CustomFieldScope" NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "labels" JSONB NOT NULL,
    "options" JSONB,
    "condition" JSONB,
    "mappable" BOOLEAN NOT NULL DEFAULT false,
    "templateFilter" BOOLEAN NOT NULL DEFAULT false,
    "listFilter" BOOLEAN NOT NULL DEFAULT false,
    "mapToRfpKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Partitioned by client (LIST on "clientId"): every client gets its own physical
-- table custom_values_<clientId>, so no single table grows with everyone's data.
-- Prisma sees it as one ordinary model; partitions are created below for the
-- existing clients and by the app (ensureCustomValuesPartition) for new ones.
CREATE TABLE "CustomFieldValue" (
    "clientId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "value" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("clientId","entityType","entityId","fieldKey")
) PARTITION BY LIST ("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomField_clientId_key_key" ON "CustomField"("clientId", "key");

-- CreateIndex
CREATE INDEX "CustomFieldValue_clientId_fieldKey_value_idx" ON "CustomFieldValue"("clientId", "fieldKey", "value");

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One partition per existing client.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT "id", "code" FROM "Client" LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF "CustomFieldValue" FOR VALUES IN (%L)',
      'custom_values_' || lower(regexp_replace(c."id", '[^a-zA-Z0-9_]', '_', 'g')),
      c."id"
    );
    EXECUTE format(
      'COMMENT ON TABLE %I IS %L',
      'custom_values_' || lower(regexp_replace(c."id", '[^a-zA-Z0-9_]', '_', 'g')),
      'Custom field values of client ' || c."code"
    );
  END LOOP;
END $$;
