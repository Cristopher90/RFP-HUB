-- CreateTable
CREATE TABLE "SystemTableLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "table" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "changes" JSONB,
    "impact" JSONB,
    "ip" TEXT,

    CONSTRAINT "SystemTableLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemTableLog_createdAt_idx" ON "SystemTableLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemTableLog_table_rowId_idx" ON "SystemTableLog"("table", "rowId");
