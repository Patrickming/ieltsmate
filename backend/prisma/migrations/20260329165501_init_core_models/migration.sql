-- AlterTable
ALTER TABLE "Todo" ALTER COLUMN "sortOrder" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "Note_category_createdAt_idx" ON "Note"("category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Note_reviewStatus_idx" ON "Note"("reviewStatus");

-- CreateIndex
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReviewLog_noteId_createdAt_idx" ON "ReviewLog"("noteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReviewLog_createdAt_idx" ON "ReviewLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Todo_taskDate_sortOrder_idx" ON "Todo"("taskDate", "sortOrder");

-- CreateIndex
CREATE INDEX "Todo_taskDate_idx" ON "Todo"("taskDate");
