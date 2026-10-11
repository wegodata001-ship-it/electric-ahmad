CREATE TABLE IF NOT EXISTS "ProjectWorkSite" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "contactName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectWorkSite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectWorkSite_projectId_status_idx" ON "ProjectWorkSite"("projectId", "status");

ALTER TABLE "ProjectWorkSite"
  ADD CONSTRAINT "ProjectWorkSite_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkDiary" ADD COLUMN IF NOT EXISTS "workSiteId" TEXT;
ALTER TABLE "OpsDeliveryNote" ADD COLUMN IF NOT EXISTS "workSiteId" TEXT;

CREATE INDEX IF NOT EXISTS "WorkDiary_workSiteId_idx" ON "WorkDiary"("workSiteId");
CREATE INDEX IF NOT EXISTS "OpsDeliveryNote_workSiteId_idx" ON "OpsDeliveryNote"("workSiteId");

ALTER TABLE "WorkDiary"
  ADD CONSTRAINT "WorkDiary_workSiteId_fkey"
  FOREIGN KEY ("workSiteId") REFERENCES "ProjectWorkSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpsDeliveryNote"
  ADD CONSTRAINT "OpsDeliveryNote_workSiteId_fkey"
  FOREIGN KEY ("workSiteId") REFERENCES "ProjectWorkSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
