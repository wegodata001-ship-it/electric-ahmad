-- Additive: portal roles + assignment work-flow fields. No data deleted.

ALTER TABLE "SubcontractorUser" ADD COLUMN IF NOT EXISTS "portalRole" TEXT NOT NULL DEFAULT 'owner';

ALTER TABLE "SubcontractorAssignment" ADD COLUMN IF NOT EXISTS "assignedUserId" TEXT;
ALTER TABLE "SubcontractorAssignment" ADD COLUMN IF NOT EXISTS "workStatus" TEXT NOT NULL DEFAULT 'assigned';
ALTER TABLE "SubcontractorAssignment" ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;
ALTER TABLE "SubcontractorAssignment" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "SubcontractorAssignment" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "SubcontractorAssignment" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SubcontractorAssignment_workStatus_idx" ON "SubcontractorAssignment"("workStatus");
CREATE INDEX IF NOT EXISTS "SubcontractorAssignment_assignedUserId_idx" ON "SubcontractorAssignment"("assignedUserId");

ALTER TABLE "SubcontractorAssignment"
  ADD CONSTRAINT "SubcontractorAssignment_assignedUserId_fkey"
  FOREIGN KEY ("assignedUserId") REFERENCES "SubcontractorUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
