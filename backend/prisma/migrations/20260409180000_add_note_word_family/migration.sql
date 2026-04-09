-- Optional structured word family (derivation by part of speech) for notes.
ALTER TABLE "Note"
ADD COLUMN "wordFamily" JSONB;
