-- Optional project manager assignment + measurement DIRECT/APPROVAL flow

CREATE TYPE "MeasurementApprovalFlow" AS ENUM ('DIRECT', 'APPROVAL');

ALTER TABLE "Project" ALTER COLUMN "ownerId" DROP NOT NULL;

ALTER TABLE "MeasurementSheet"
  ADD COLUMN "approvalFlow" "MeasurementApprovalFlow",
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "finalizedById" TEXT;

CREATE INDEX "MeasurementSheet_approvalFlow_idx" ON "MeasurementSheet"("approvalFlow");
