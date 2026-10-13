-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "assistantApiKeyEnc" TEXT,
ADD COLUMN     "assistantApiKeyLast4" TEXT,
ADD COLUMN     "assistantEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "assistantModel" TEXT NOT NULL DEFAULT 'claude-opus-5-5';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canUseAssistant" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AssistantLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "tools" JSONB,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "AssistantLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantProposal" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rfpId" TEXT,

    CONSTRAINT "AssistantProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantLog_clientId_createdAt_idx" ON "AssistantLog"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantLog_userId_createdAt_idx" ON "AssistantLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantProposal_userId_status_idx" ON "AssistantProposal"("userId", "status");
