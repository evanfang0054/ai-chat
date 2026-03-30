-- AlterEnum
ALTER TYPE "ScheduleType" ADD VALUE 'INTERVAL';

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN     "intervalMs" INTEGER;
