-- Add optional review extension fields for note-level POS/confusable data.
ALTER TABLE "Note"
ADD COLUMN "partsOfSpeech" JSONB,
ADD COLUMN "confusables" JSONB;
