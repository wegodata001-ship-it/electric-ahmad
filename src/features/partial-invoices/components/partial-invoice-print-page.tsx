"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { invoiceService } from "@/features/partial-invoices/services/invoice.service";
import type { PartialInvoice, ProjectInvoiceApproval } from "@/types";
import { INVOICE_STATUS_LABELS } from "@/constants";
import {
  AccountTemplate,
  PdfPrintShell,
  type AccountPdfModel,
} from "@/lib/pdf-engine";

/**
 * Thin loader — contractor account PDF via central engine.
 * Old layout removed; AccountTemplate is the only account print template.
 */
export function PartialInvoicePrintPage({ invoiceId }: { invoiceId: string }) {
  return (
    <Suspense
      fallback={
        <p className="p-10 text-center text-sm text-gray-400" dir="rtl">
          טוען חשבון…
        </p>
      }
    >
      <PartialInvoicePrintInner invoiceId={invoiceId} />
    </Suspense>
  );
}

function PartialInvoicePrintInner({ invoiceId }: { invoiceId: string }) {
  const searchParams = useSearchParams();
  const [invoice, setInvoice] = useState<PartialInvoice | null>(null);
  const [approvals, setApprovals] = useState<ProjectInvoiceApproval[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      invoiceService.getById(invoiceId),
      invoiceService.getApprovals(invoiceId),
    ])
      .then(([inv, apps]) => {
        setInvoice(inv);
        setApprovals(apps);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינת החשבון")
      );
  }, [invoiceId]);

  // Keep searchParams referenced so Suspense boundary is correct; autoprint handled by shell
  void searchParams;

  if (error) {
    return (
      <div className="p-10 text-center text-sm text-red-600" dir="rtl">
        {error}
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-10 text-center text-sm text-gray-400" dir="rtl">
        טוען חשבון…
      </div>
    );
  }

  const model = toAccountModel(invoice, approvals);

  return (
    <PdfPrintShell title="חשבון קבלני">
      <AccountTemplate model={model} />
    </PdfPrintShell>
  );
}

function overallFinancialPercent(
  items: {
    contractQuantity: number;
    unitPrice: number;
    financialPercent: number;
  }[]
): number {
  let weight = 0;
  let sum = 0;
  for (const item of items) {
    const contractValue = item.contractQuantity * item.unitPrice;
    if (contractValue <= 0) continue;
    weight += contractValue;
    sum += item.financialPercent * contractValue;
  }
  return weight > 0 ? sum / weight : 0;
}

function toAccountModel(
  invoice: PartialInvoice,
  approvals: ProjectInvoiceApproval[]
): AccountPdfModel {
  const approverName =
    invoice.approverNameSnapshot ||
    approvals.find((a) => a.status === "approved")?.managerName ||
    approvals[0]?.managerName ||
    null;
  const collator = new Intl.Collator("he", { numeric: true });
  const items = invoice.includedItems
    .map((item) => ({
      code: item.code,
      description: item.description,
      unit: item.unit,
      contractQuantity: item.contractQuantity,
      previousQuantity: item.previousQuantity,
      quantity: item.quantity,
      cumulativeQuantity: item.cumulativeQuantity,
      quantityPercent: item.quantityPercent,
      unitPrice: item.unitPrice,
      previousAmount: item.previousAmount,
      total: item.total,
      cumulativeAmount: item.cumulativeAmount,
      financialPercent: item.financialPercent,
    }))
    .sort((a, b) => collator.compare(a.code || "", b.code || ""));

  return {
    documentTitle: "חשבון חלקי",
    invoiceNumber: invoice.invoiceNumber,
    sequenceNumber: invoice.sequenceNumber,
    date: invoice.date,
    createdAt: invoice.createdAt,
    billingMonth: invoice.billingMonth,
    billTo: invoice.billTo,
    contractor: invoice.contractor,
    notes: invoice.notes,
    projectName: invoice.projectName,
    projectContractNumber: invoice.projectContractNumber,
    projectLocation: invoice.projectLocation,
    projectForemanName: invoice.projectForemanName,
    company: invoice.companySnapshot,
    statusLabel: INVOICE_STATUS_LABELS[invoice.status],
    subtotal: invoice.subtotal ?? invoice.amount,
    vatPercent: invoice.vatPercent ?? 0,
    vatAmount: invoice.vatAmount ?? 0,
    totalWithVat: invoice.totalWithVat ?? invoice.amount,
    previousTotal: invoice.previousTotal,
    currentTotal: invoice.amount,
    cumulativeTotal: invoice.cumulativeTotal,
    overallPercent: overallFinancialPercent(items),
    items,
    approverName,
  };
}
