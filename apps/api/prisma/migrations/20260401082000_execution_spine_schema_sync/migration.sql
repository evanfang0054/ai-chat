-- AlterEnum
BEGIN;
CREATE TYPE "ErrorCategory_new" AS ENUM ('INPUT_ERROR', 'TOOL_ERROR', 'MODEL_ERROR', 'DEPENDENCY_ERROR', 'TIMEOUT_ERROR', 'SYSTEM_ERROR', 'CANCELLED');
ALTER TABLE "ScheduleRun" ALTER COLUMN "errorCategory" TYPE "ErrorCategory_new" USING ("errorCategory"::text::"ErrorCategory_new");
ALTER TYPE "ErrorCategory" RENAME TO "ErrorCategory_old";
ALTER TYPE "ErrorCategory_new" RENAME TO "ErrorCategory";
DROP TYPE "public"."ErrorCategory_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "RunStage_new" AS ENUM ('PREPARING', 'ROUTING', 'MODEL_CALLING', 'TOOL_RUNNING', 'REPAIRING', 'PERSISTING', 'FINALIZING');
ALTER TABLE "public"."ScheduleRun" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "ScheduleRun"
ALTER COLUMN "stage" TYPE "RunStage_new"
USING (
  CASE "stage"::text
    WHEN 'QUEUED' THEN 'PREPARING'
    WHEN 'AGENT' THEN 'ROUTING'
    WHEN 'LLM' THEN 'MODEL_CALLING'
    WHEN 'TOOL' THEN 'TOOL_RUNNING'
    WHEN 'PERSISTENCE' THEN 'PERSISTING'
    WHEN 'COMPLETED' THEN 'FINALIZING'
    ELSE 'PREPARING'
  END::"RunStage_new"
);
ALTER TYPE "RunStage" RENAME TO "RunStage_old";
ALTER TYPE "RunStage_new" RENAME TO "RunStage";
DROP TYPE "public"."RunStage_old";
ALTER TABLE "ScheduleRun" ALTER COLUMN "stage" SET DEFAULT 'PREPARING';
COMMIT;

-- AlterEnum
ALTER TYPE "RunTriggerSource" ADD VALUE 'USER';
ALTER TYPE "RunTriggerSource" ADD VALUE 'DIAGNOSTICS_REPLAY';

-- AlterEnum
BEGIN;
CREATE TYPE "ScheduleRunStatus_new" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
ALTER TABLE "public"."ScheduleRun" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ScheduleRun"
ALTER COLUMN "status" TYPE "ScheduleRunStatus_new"
USING (
  CASE "status"::text
    WHEN 'SUCCEEDED' THEN 'COMPLETED'
    ELSE "status"::text
  END::"ScheduleRunStatus_new"
);
ALTER TYPE "ScheduleRunStatus" RENAME TO "ScheduleRunStatus_old";
ALTER TYPE "ScheduleRunStatus_new" RENAME TO "ScheduleRunStatus";
DROP TYPE "public"."ScheduleRunStatus_old";
ALTER TABLE "ScheduleRun" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
ALTER TYPE "ToolExecutionStatus" ADD VALUE 'PENDING';
ALTER TYPE "ToolExecutionStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "runId" TEXT;

-- AlterTable
ALTER TABLE "ScheduleRun"
ADD COLUMN "requestId" TEXT,
ALTER COLUMN "stage" SET DEFAULT 'PREPARING';

-- AlterTable
ALTER TABLE "ToolExecution"
ADD COLUMN "messageId" TEXT,
ADD COLUMN "partialOutput" TEXT,
ADD COLUMN "progressMessage" TEXT,
ADD COLUMN "requestId" TEXT,
ADD COLUMN "runId" TEXT;

-- CreateIndex
CREATE INDEX "ChatMessage_runId_createdAt_idx" ON "ChatMessage"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleRun_requestId_createdAt_idx" ON "ScheduleRun"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolExecution_runId_startedAt_idx" ON "ToolExecution"("runId", "startedAt");

-- CreateIndex
CREATE INDEX "ToolExecution_messageId_startedAt_idx" ON "ToolExecution"("messageId", "startedAt");

-- CreateIndex
CREATE INDEX "ToolExecution_requestId_startedAt_idx" ON "ToolExecution"("requestId", "startedAt");
