ALTER TABLE "Project"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT,
ADD COLUMN "deletionReason" TEXT;

CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");
