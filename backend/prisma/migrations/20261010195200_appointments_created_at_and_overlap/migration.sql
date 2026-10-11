-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "schedule_blocks" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Atomic slot lock: overlapping SCHEDULED/COMPLETED appointments are rejected at the database
ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_no_overlap"
EXCLUDE USING gist (
  tsrange("start_time", "end_time") WITH &&
) WHERE ("status" <> 'CANCELLED');
