-- CreateEnum
CREATE TYPE "ErrorCategory" AS ENUM ('USER_ERROR', 'EXTERNAL_ERROR', 'INTERNAL_ERROR');

-- CreateEnum
CREATE TYPE "RunStage" AS ENUM ('QUEUED', 'AGENT', 'LLM', 'TOOL', 'PERSISTENCE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RunTriggerSource" AS ENUM ('SCHEDULE', 'MANUAL_RETRY');

-- AlterTable
ALTER TABLE "ScheduleRun"
ADD COLUMN "stage" "RunStage" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN "errorCategory" "ErrorCategory",
ADD COLUMN "triggerSource" "RunTriggerSource" NOT NULL DEFAULT 'SCHEDULE';
