CREATE TABLE "AiReadingReviewBatch" (
  "id" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "rangeType" TEXT NOT NULL,
  "categoryFilter" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "targetArticles" INTEGER,
  "generateAll" BOOLEAN NOT NULL DEFAULT false,
  "timeoutSeconds" INTEGER NOT NULL DEFAULT 360,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "totalNotes" INTEGER NOT NULL DEFAULT 0,
  "usedNotes" INTEGER NOT NULL DEFAULT 0,
  "generatedArticles" INTEGER NOT NULL DEFAULT 0,
  "failedArticles" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiReadingReviewBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiReadingArticle" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "article" TEXT NOT NULL,
  "paragraphTranslations" JSONB,
  "wordCount" INTEGER NOT NULL,
  "questions" JSONB NOT NULL,
  "answers" JSONB NOT NULL,
  "explanations" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "generationMs" INTEGER NOT NULL DEFAULT 0,
  "qualityWarnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiReadingArticle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiReadingArticleNote" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "noteId" TEXT,
  "noteContent" TEXT NOT NULL,
  "noteTranslation" TEXT NOT NULL,
  "noteCategory" TEXT NOT NULL,
  "expression" TEXT NOT NULL,
  "isVariant" BOOLEAN NOT NULL DEFAULT false,
  "explanation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiReadingArticleNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiReadingReviewBatch_createdAt_idx" ON "AiReadingReviewBatch"("createdAt" DESC);
CREATE INDEX "AiReadingReviewBatch_status_idx" ON "AiReadingReviewBatch"("status");
CREATE INDEX "AiReadingArticle_batchId_createdAt_idx" ON "AiReadingArticle"("batchId", "createdAt");
CREATE INDEX "AiReadingArticleNote_articleId_idx" ON "AiReadingArticleNote"("articleId");
CREATE INDEX "AiReadingArticleNote_noteId_idx" ON "AiReadingArticleNote"("noteId");

ALTER TABLE "AiReadingArticle"
  ADD CONSTRAINT "AiReadingArticle_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "AiReadingReviewBatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiReadingArticleNote"
  ADD CONSTRAINT "AiReadingArticleNote_articleId_fkey"
  FOREIGN KEY ("articleId") REFERENCES "AiReadingArticle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiReadingArticleNote"
  ADD CONSTRAINT "AiReadingArticleNote_noteId_fkey"
  FOREIGN KEY ("noteId") REFERENCES "Note"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
