-- AlterTable
ALTER TABLE "AiModel" ADD COLUMN     "isThinking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVision" BOOLEAN NOT NULL DEFAULT false;
