-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "assistantProvider" TEXT NOT NULL DEFAULT 'anthropic',
ADD COLUMN     "geminiApiKeyEnc" TEXT,
ADD COLUMN     "geminiApiKeyLast4" TEXT,
ADD COLUMN     "geminiModel" TEXT NOT NULL DEFAULT 'gemini-3.8-flash';
