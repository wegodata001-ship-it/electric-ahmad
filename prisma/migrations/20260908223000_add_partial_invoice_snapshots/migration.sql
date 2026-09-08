ALTER TABLE "PartialInvoice"
ADD COLUMN "projectNameSnapshot" TEXT,
ADD COLUMN "projectContractNumberSnapshot" TEXT,
ADD COLUMN "projectLocationSnapshot" TEXT,
ADD COLUMN "projectForemanNameSnapshot" TEXT,
ADD COLUMN "companySnapshotJson" TEXT,
ADD COLUMN "approverNameSnapshot" TEXT,
ADD COLUMN "previousTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "cumulativeTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "snapshotLockedAt" TIMESTAMP(3);

ALTER TABLE "InvoiceItem"
ADD COLUMN "previousAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "InvoiceItem"
SET "previousAmount" = ROUND("previousQuantity" * "unitPrice", 2);

UPDATE "PartialInvoice" AS invoice
SET
  "projectNameSnapshot" = project."name",
  "projectContractNumberSnapshot" = project."contractNumber",
  "projectLocationSnapshot" = project."location",
  "projectForemanNameSnapshot" = CONCAT_WS(' ', foreman."firstName", foreman."lastName")
FROM "Project" AS project
LEFT JOIN "Employee" AS foreman ON foreman."id" = project."foremanId"
WHERE project."id" = invoice."projectId";

UPDATE "PartialInvoice" AS invoice
SET
  "previousTotal" = COALESCE((
    SELECT SUM(previous."amount")
    FROM "PartialInvoice" AS previous
    WHERE previous."projectId" = invoice."projectId"
      AND previous."sequenceNumber" < invoice."sequenceNumber"
  ), 0),
  "cumulativeTotal" = COALESCE((
    SELECT SUM(previous."amount")
    FROM "PartialInvoice" AS previous
    WHERE previous."projectId" = invoice."projectId"
      AND previous."sequenceNumber" < invoice."sequenceNumber"
  ), 0) + invoice."amount",
  "snapshotLockedAt" = CASE
    WHEN invoice."status" IN (
      'approved_by_foreman',
      'sent_to_client',
      'paid',
      'approved'
    ) THEN COALESCE(invoice."updatedAt", CURRENT_TIMESTAMP)
    ELSE NULL
  END;

UPDATE "PartialInvoice" AS invoice
SET "approverNameSnapshot" = approved."name"
FROM (
  SELECT DISTINCT ON (approval."invoiceId")
    approval."invoiceId",
    COALESCE(
      approver."name",
      CONCAT_WS(' ', manager."firstName", manager."lastName")
    ) AS "name"
  FROM "ProjectInvoiceApproval" AS approval
  LEFT JOIN "User" AS approver ON approver."id" = approval."approverUserId"
  LEFT JOIN "Employee" AS manager ON manager."id" = approval."managerId"
  WHERE approval."status" = 'approved'
  ORDER BY approval."invoiceId", approval."approvedAt" DESC NULLS LAST
) AS approved
WHERE approved."invoiceId" = invoice."id";
