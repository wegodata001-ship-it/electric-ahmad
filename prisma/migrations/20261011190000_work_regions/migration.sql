-- CreateTable
CREATE TABLE "WorkRegion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkRegion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkRegion_name_key" ON "WorkRegion"("name");
CREATE INDEX "WorkRegion_active_sortOrder_idx" ON "WorkRegion"("active", "sortOrder");

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "workRegionId" TEXT;
ALTER TABLE "ProjectWorkSite" ADD COLUMN "workRegionId" TEXT;

CREATE INDEX "Project_workRegionId_idx" ON "Project"("workRegionId");
CREATE INDEX "ProjectWorkSite_workRegionId_idx" ON "ProjectWorkSite"("workRegionId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_workRegionId_fkey" FOREIGN KEY ("workRegionId") REFERENCES "WorkRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectWorkSite" ADD CONSTRAINT "ProjectWorkSite_workRegionId_fkey" FOREIGN KEY ("workRegionId") REFERENCES "WorkRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed editable default regions. Do not assign existing projects.
INSERT INTO "WorkRegion" ("id", "name", "sortOrder", "active", "updatedAt")
VALUES
  ('region_north', 'צפון', 1, true, CURRENT_TIMESTAMP),
  ('region_center', 'מרכז', 2, true, CURRENT_TIMESTAMP),
  ('region_south', 'דרום', 3, true, CURRENT_TIMESTAMP);
