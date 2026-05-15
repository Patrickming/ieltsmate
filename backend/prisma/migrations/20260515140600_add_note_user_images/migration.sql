-- Allow note user-notes to store image URLs and optional empty text content.
ALTER TABLE "NoteUserNote"
ALTER COLUMN "content" SET DEFAULT '',
ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
