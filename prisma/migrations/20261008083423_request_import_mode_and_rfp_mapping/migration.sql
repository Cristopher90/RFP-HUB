/*
  Warnings:

  - You are about to drop the column `rfpMapping` on the `RequestImportTemplate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RequestImportTemplate" DROP COLUMN "rfpMapping",
ADD COLUMN     "importMode" TEXT NOT NULL DEFAULT 'MASS';

-- CreateTable
CREATE TABLE "RequestRfpMapping" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestRfpMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequestRfpMapping_clientId_key" ON "RequestRfpMapping"("clientId");

-- AddForeignKey
ALTER TABLE "RequestRfpMapping" ADD CONSTRAINT "RequestRfpMapping_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
