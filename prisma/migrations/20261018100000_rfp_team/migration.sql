-- CreateEnum
CREATE TYPE "RfpMemberPermission" AS ENUM ('VIEW', 'EDIT');

-- CreateTable
CREATE TABLE "RfpMember" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "RfpMemberPermission" NOT NULL DEFAULT 'VIEW',
    "addedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfpMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RfpMember_userId_idx" ON "RfpMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RfpMember_rfpId_userId_key" ON "RfpMember"("rfpId", "userId");

-- AddForeignKey
ALTER TABLE "RfpMember" ADD CONSTRAINT "RfpMember_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpMember" ADD CONSTRAINT "RfpMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

