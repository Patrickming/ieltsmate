-- Persist British pronunciation MP3 URL from dictionary API (phonetic already exists).
ALTER TABLE "Note" ADD COLUMN "pronunciationAudioUrl" TEXT;
