-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('BUYER', 'SUPPLIER');

-- CreateTable
CREATE TABLE "RfpMessage" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "senderUserId" TEXT,
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "RfpMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RfpMessage_rfpId_invitationId_createdAt_idx" ON "RfpMessage"("rfpId", "invitationId", "createdAt");

-- CreateIndex
CREATE INDEX "RfpMessage_invitationId_sender_readAt_idx" ON "RfpMessage"("invitationId", "sender", "readAt");

-- AddForeignKey
ALTER TABLE "RfpMessage" ADD CONSTRAINT "RfpMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpMessage" ADD CONSTRAINT "RfpMessage_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpMessage" ADD CONSTRAINT "RfpMessage_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfpMessage" ADD CONSTRAINT "RfpMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
