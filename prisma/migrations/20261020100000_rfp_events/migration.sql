-- CreateTable
CREATE TABLE "RfpEvent" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RfpEvent_rfpId_createdAt_idx" ON "RfpEvent"("rfpId", "createdAt");

-- AddForeignKey
ALTER TABLE "RfpEvent" ADD CONSTRAINT "RfpEvent_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpEvent" ADD CONSTRAINT "RfpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

