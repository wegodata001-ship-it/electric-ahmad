-- Subcontractors domain (additive only). Does not alter client BOQ / invoices / measurement sheets.

CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "taxId" TEXT,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT,
    "specialty" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "preferredPaymentMethod" TEXT,
    "bankDetails" TEXT,
    "paymentTerms" TEXT,
    "taxNotes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subcontractor_code_key" ON "Subcontractor"("code");
CREATE INDEX "Subcontractor_status_idx" ON "Subcontractor"("status");
CREATE INDEX "Subcontractor_companyName_idx" ON "Subcontractor"("companyName");
CREATE INDEX "Subcontractor_email_idx" ON "Subcontractor"("email");

CREATE TABLE "SubcontractorUser" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractorUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubcontractorUser_userId_key" ON "SubcontractorUser"("userId");
CREATE INDEX "SubcontractorUser_subcontractorId_status_idx" ON "SubcontractorUser"("subcontractorId", "status");

CREATE TABLE "SubcontractorInvite" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubcontractorInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubcontractorInvite_tokenHash_key" ON "SubcontractorInvite"("tokenHash");
CREATE INDEX "SubcontractorInvite_subcontractorId_idx" ON "SubcontractorInvite"("subcontractorId");
CREATE INDEX "SubcontractorInvite_email_idx" ON "SubcontractorInvite"("email");

CREATE TABLE "SubcontractorAssignment" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workSiteId" TEXT,
    "managerId" TEXT,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "engagementType" TEXT NOT NULL DEFAULT 'mixed',
    "amount" DECIMAL(14,2),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractorAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubcontractorAssignment_subcontractorId_status_idx" ON "SubcontractorAssignment"("subcontractorId", "status");
CREATE INDEX "SubcontractorAssignment_projectId_status_idx" ON "SubcontractorAssignment"("projectId", "status");
CREATE INDEX "SubcontractorAssignment_workSiteId_idx" ON "SubcontractorAssignment"("workSiteId");

CREATE TABLE "SubcontractorRate" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractorRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubcontractorRate_subcontractorId_idx" ON "SubcontractorRate"("subcontractorId");
CREATE INDEX "SubcontractorRate_assignmentId_idx" ON "SubcontractorRate"("assignmentId");

CREATE TABLE "SubcontractorDocument" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubcontractorDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubcontractorDocument_subcontractorId_category_idx" ON "SubcontractorDocument"("subcontractorId", "category");

CREATE TABLE "SubcontractorMeasurement" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractorMeasurement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubcontractorMeasurement_subcontractorId_status_idx" ON "SubcontractorMeasurement"("subcontractorId", "status");
CREATE INDEX "SubcontractorMeasurement_assignmentId_status_idx" ON "SubcontractorMeasurement"("assignmentId", "status");
CREATE INDEX "SubcontractorMeasurement_projectId_status_idx" ON "SubcontractorMeasurement"("projectId", "status");

CREATE TABLE "SubcontractorMeasurementItem" (
    "id" TEXT NOT NULL,
    "measurementId" TEXT NOT NULL,
    "rateId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "reportedQty" DECIMAL(12,4) NOT NULL,
    "approvedQty" DECIMAL(12,4),
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "SubcontractorMeasurementItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubcontractorMeasurementItem_measurementId_idx" ON "SubcontractorMeasurementItem"("measurementId");
CREATE INDEX "SubcontractorMeasurementItem_billed_idx" ON "SubcontractorMeasurementItem"("billed");

CREATE TABLE "SubcontractorAccount" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "vatAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "advances" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "retention" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payable" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "officialInvoiceRef" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractorAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubcontractorAccount_subcontractorId_status_idx" ON "SubcontractorAccount"("subcontractorId", "status");
CREATE INDEX "SubcontractorAccount_assignmentId_idx" ON "SubcontractorAccount"("assignmentId");
CREATE INDEX "SubcontractorAccount_projectId_status_idx" ON "SubcontractorAccount"("projectId", "status");

CREATE TABLE "SubcontractorAccountItem" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "measurementItemId" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SubcontractorAccountItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubcontractorAccountItem_measurementItemId_key" ON "SubcontractorAccountItem"("measurementItemId");
CREATE INDEX "SubcontractorAccountItem_accountId_idx" ON "SubcontractorAccountItem"("accountId");

CREATE TABLE "SubcontractorPayment" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "accountId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "documentPath" TEXT,
    "documentBucket" TEXT,
    "createdById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubcontractorPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubcontractorPayment_subcontractorId_paidAt_idx" ON "SubcontractorPayment"("subcontractorId", "paidAt");
CREATE INDEX "SubcontractorPayment_accountId_idx" ON "SubcontractorPayment"("accountId");
CREATE INDEX "SubcontractorPayment_reference_idx" ON "SubcontractorPayment"("reference");

CREATE TABLE "SubcontractorLedgerEntry" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "actorId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubcontractorLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubcontractorLedgerEntry_subcontractorId_date_idx" ON "SubcontractorLedgerEntry"("subcontractorId", "date");
CREATE INDEX "SubcontractorLedgerEntry_projectId_idx" ON "SubcontractorLedgerEntry"("projectId");
CREATE INDEX "SubcontractorLedgerEntry_sourceType_sourceId_idx" ON "SubcontractorLedgerEntry"("sourceType", "sourceId");

ALTER TABLE "WorkDiary" ADD COLUMN "subcontractorId" TEXT;
ALTER TABLE "WorkDiary" ADD COLUMN "assignmentId" TEXT;
CREATE INDEX "WorkDiary_subcontractorId_idx" ON "WorkDiary"("subcontractorId");
CREATE INDEX "WorkDiary_assignmentId_idx" ON "WorkDiary"("assignmentId");

ALTER TABLE "Subcontractor" ADD CONSTRAINT "Subcontractor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorUser" ADD CONSTRAINT "SubcontractorUser_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorUser" ADD CONSTRAINT "SubcontractorUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorInvite" ADD CONSTRAINT "SubcontractorInvite_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorInvite" ADD CONSTRAINT "SubcontractorInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubcontractorAssignment" ADD CONSTRAINT "SubcontractorAssignment_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorAssignment" ADD CONSTRAINT "SubcontractorAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorAssignment" ADD CONSTRAINT "SubcontractorAssignment_workSiteId_fkey" FOREIGN KEY ("workSiteId") REFERENCES "ProjectWorkSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorAssignment" ADD CONSTRAINT "SubcontractorAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorRate" ADD CONSTRAINT "SubcontractorRate_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorRate" ADD CONSTRAINT "SubcontractorRate_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SubcontractorAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorDocument" ADD CONSTRAINT "SubcontractorDocument_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorDocument" ADD CONSTRAINT "SubcontractorDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorMeasurement" ADD CONSTRAINT "SubcontractorMeasurement_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorMeasurement" ADD CONSTRAINT "SubcontractorMeasurement_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SubcontractorAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorMeasurement" ADD CONSTRAINT "SubcontractorMeasurement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorMeasurement" ADD CONSTRAINT "SubcontractorMeasurement_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorMeasurement" ADD CONSTRAINT "SubcontractorMeasurement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorMeasurementItem" ADD CONSTRAINT "SubcontractorMeasurementItem_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "SubcontractorMeasurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorAccount" ADD CONSTRAINT "SubcontractorAccount_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorAccount" ADD CONSTRAINT "SubcontractorAccount_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SubcontractorAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorAccount" ADD CONSTRAINT "SubcontractorAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorAccount" ADD CONSTRAINT "SubcontractorAccount_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorAccount" ADD CONSTRAINT "SubcontractorAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorAccountItem" ADD CONSTRAINT "SubcontractorAccountItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SubcontractorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorAccountItem" ADD CONSTRAINT "SubcontractorAccountItem_measurementItemId_fkey" FOREIGN KEY ("measurementItemId") REFERENCES "SubcontractorMeasurementItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorPayment" ADD CONSTRAINT "SubcontractorPayment_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorPayment" ADD CONSTRAINT "SubcontractorPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SubcontractorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorPayment" ADD CONSTRAINT "SubcontractorPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubcontractorPayment" ADD CONSTRAINT "SubcontractorPayment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorLedgerEntry" ADD CONSTRAINT "SubcontractorLedgerEntry_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubcontractorLedgerEntry" ADD CONSTRAINT "SubcontractorLedgerEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubcontractorLedgerEntry" ADD CONSTRAINT "SubcontractorLedgerEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkDiary" ADD CONSTRAINT "WorkDiary_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkDiary" ADD CONSTRAINT "WorkDiary_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "SubcontractorAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
