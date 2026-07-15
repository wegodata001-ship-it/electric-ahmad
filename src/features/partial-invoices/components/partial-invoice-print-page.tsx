"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { invoiceService } from "@/features/partial-invoices/services/invoice.service";
import type { InvoiceItem, PartialInvoice, ProjectInvoiceApproval } from "@/types";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/utils/format";

export function PartialInvoicePrintPage({ invoiceId }: { invoiceId: string }) {
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
        window.setTimeout(() => {
          if (searchParams.get("download") || searchParams.get("autoprint")) {
            window.print();
          }
        }, 450);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינת החשבון")
      );
  }, [invoiceId, searchParams]);

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
        טוען חשבון...
      </div>
    );
  }

  const blue = "#1e40af";
  const blueDark = "#1e3a8a";
  const businessName = invoice.contractor?.trim() || invoice.projectName;
  const subtotal = invoice.subtotal ?? invoice.amount;
  const vatPercent = invoice.vatPercent ?? 0;
  const vatAmount = invoice.vatAmount ?? 0;
  const totalWithVat = invoice.totalWithVat ?? invoice.amount;
  const overallPct = overallFinancialPercent(invoice.includedItems);
  const approverName =
    approvals.find((a) => a.status === "approved")?.managerName ||
    approvals[0]?.managerName ||
    "";

  return (
    <div
      className="inv-doc min-h-screen bg-[#eef1f5] text-[#111827] print:bg-white"
      dir="rtl"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Heebo:wght@400;600;700&display=swap');
        .inv-doc { font-family: 'Assistant', 'Heebo', Arial, sans-serif; }
        @page {
          size: A4 portrait;
          margin: 12mm 10mm 18mm 10mm;
          @bottom-center {
            content: "עמוד " counter(page);
            font-family: Assistant, Heebo, Arial, sans-serif;
            font-size: 9px;
            color: #6b7280;
          }
        }
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .inv-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 0 0 14px !important; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr { page-break-inside: avoid; }
          .inv-avoid-break { page-break-inside: avoid; break-inside: avoid; }
          .inv-print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 5px 2mm 0;
            background: white;
            font-size: 9px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            direction: rtl;
          }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white/95 border-b border-gray-200 px-4 py-3 flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 text-sm text-white rounded-lg"
          style={{ background: blue }}
        >
          הדפסה / שמירה כ-PDF
        </button>
        <button
          type="button"
          onClick={() => window.close()}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white"
        >
          סגור
        </button>
      </div>

      <div className="inv-sheet max-w-[210mm] mx-auto my-6 bg-white shadow-lg print:shadow-none print:my-0 px-6 py-6">
        {/* Business name + invoice identifiers */}
        <header className="inv-avoid-break flex justify-between items-start gap-6 pb-3">
          <div className="min-w-0 flex-1">
            <p
              className="text-[22px] font-bold tracking-wide"
              style={{ color: blueDark }}
            >
              {businessName}
            </p>
          </div>

          {/* Invoice identifiers */}
          <div className="text-left shrink-0 min-w-[175px]">
            <div className="text-[11.5px] leading-6 space-y-0.5">
              <MetaRow
                label="מספר החשבון"
                value={String(invoice.sequenceNumber || invoice.invoiceNumber)}
              />
              <MetaRow
                label="תאריך החשבון"
                value={formatDate(invoice.date)}
              />
              <MetaRow
                label="חודש החשבון"
                value={invoice.billingMonth || "—"}
              />
              <MetaRow
                label="מספר הפרויקט"
                value={invoice.projectContractNumber || "—"}
              />
            </div>
          </div>
        </header>

        {/* 3. Full-width separator */}
        <div
          className="mb-4 mt-1"
          style={{ borderBottom: `2px solid ${blue}` }}
        />

        {/* 4–5. Client + Project — after separator only */}
        <section className="inv-avoid-break grid grid-cols-2 gap-3 mb-4">
          <InfoCard title="פרטי הלקוח" blue={blue}>
            <Field label="שם לקוח" value={invoice.billTo} />
            <Field label="איש קשר" value="" />
            <Field label="טלפון" value="" />
            <Field label="כתובת" value="" />
            <Field label="עיר" value="" />
          </InfoCard>
          <InfoCard title="פרטי הפרויקט" blue={blue}>
            <Field label="שם הפרויקט" value={invoice.projectName} />
            <Field label="מספר חוזה" value={invoice.projectContractNumber} />
            <Field label="מספר עבודה" value="" />
            <Field label="מנהל עבודה" value={invoice.projectForemanName} />
            <Field label="מיקום" value={invoice.projectLocation} />
          </InfoCard>
        </section>

        {/* Items table */}
        <section className="mb-4">
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr style={{ background: blueDark, color: "#fff" }}>
                <Th>סעיף</Th>
                <Th>תיאור</Th>
                <Th>יחידה</Th>
                <Th>כמות חוזה</Th>
                <Th>מצטבר קודם</Th>
                <Th>כמות נוכחית</Th>
                <Th>מצטבר לאחר</Th>
                <Th>אחוז כמותי</Th>
                <Th>מחיר יחידה</Th>
                <Th>סכום נוכחי</Th>
                <Th>סכום מצטבר</Th>
                <Th>אחוז כספי</Th>
              </tr>
            </thead>
            <tbody>
              {invoice.includedItems.map((item, index) => (
                <tr
                  key={`${item.boqItemId}-${item.code}-${index}`}
                  style={{
                    background: index % 2 === 0 ? "#ffffff" : "#f3f4f6",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <Td className="font-mono text-gray-600 whitespace-nowrap">
                    {item.code}
                  </Td>
                  <Td className="font-medium text-gray-900 min-w-[90px]">
                    {item.description}
                  </Td>
                  <Td className="text-gray-600 whitespace-nowrap">
                    {item.unit}
                  </Td>
                  <Td align="right">{formatNumber(item.contractQuantity)}</Td>
                  <Td align="right">{formatNumber(item.previousQuantity)}</Td>
                  <Td align="right" className="font-semibold">
                    {formatNumber(item.quantity)}
                  </Td>
                  <Td align="right">
                    {formatNumber(item.cumulativeQuantity)}
                  </Td>
                  <Td>
                    <PctCell
                      value={item.quantityPercent}
                      blue={blue}
                    />
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    {formatCurrency(item.unitPrice)}
                  </Td>
                  <Td align="right" className="font-semibold whitespace-nowrap">
                    {formatCurrency(item.total)}
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    {formatCurrency(item.cumulativeAmount)}
                  </Td>
                  <Td>
                    <PctCell
                      value={item.financialPercent}
                      blue={blue}
                    />
                  </Td>
                </tr>
              ))}
              {invoice.includedItems.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    className="text-center py-6 text-gray-400 text-[11px]"
                  >
                    אין סעיפים בחשבון זה
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section
          className="inv-avoid-break mb-4 text-[11px]"
          style={{ border: `1px solid ${blue}55` }}
        >
          <div
            className="px-3 py-1.5 font-bold text-white text-[11px]"
            style={{ background: blue }}
          >
            סיכום חשבון
          </div>
          <div className="grid grid-cols-2 gap-0">
            <div className="p-3 space-y-1.5 border-l border-gray-200">
              <TotalRow label='סה"כ לפני מע"מ' value={formatCurrency(subtotal)} />
              <TotalRow
                label={`מע"מ (${formatNumber(vatPercent, 1)}%)`}
                value={formatCurrency(vatAmount)}
              />
              <TotalRow
                label="אחוז ביצוע כולל"
                value={formatPercent(overallPct)}
              />
              <TotalRow
                label="מספר הסעיפים"
                value={String(invoice.includedItems.length)}
              />
            </div>
            <div className="p-3 flex flex-col justify-center">
              <p className="text-gray-500 text-[10px] mb-1">
                סה&quot;כ כולל מע&quot;מ
              </p>
              <p
                className="text-[22px] font-bold leading-none"
                style={{ color: blueDark }}
              >
                {formatCurrency(totalWithVat)}
              </p>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section
          className="inv-avoid-break mb-4 p-3 min-h-[72px] text-[11px]"
          style={{ border: "1px solid #d1d5db" }}
        >
          <p className="font-bold mb-1.5" style={{ color: blue }}>
            הערות
          </p>
          <p className="text-gray-700 whitespace-pre-wrap min-h-[40px]">
            {invoice.notes?.trim() || ""}
          </p>
        </section>

        {/* Approval / signatures */}
        <section
          className="inv-avoid-break mb-6 p-3 text-[11px]"
          style={{ border: `1px solid ${blue}40` }}
        >
          <p className="font-bold mb-3" style={{ color: blue }}>
            אישור החשבון
          </p>
          <div className="grid grid-cols-4 gap-4">
            <SignCol label="שם המאשר" value={approverName || "________________"} />
            <SignCol label="חתימת קבלן" value="" line />
            <SignCol label="חתימת החברה" value="" line />
            <SignCol
              label="תאריך"
              value={formatDate(invoice.date)}
            />
          </div>
        </section>

      </div>
    </div>
  );
}

function overallFinancialPercent(items: InvoiceItem[]): number {
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-gray-500">{label}: </span>
      <span className="font-bold text-gray-900">{value}</span>
    </p>
  );
}

function InfoCard({
  title,
  blue,
  children,
}: {
  title: string;
  blue: string;
  children: ReactNode;
}) {
  return (
    <div style={{ border: `1px solid ${blue}40`, background: "#fafcff" }}>
      <div
        className="px-3 py-1.5 text-[10px] font-bold tracking-wide text-white"
        style={{ background: blue }}
      >
        {title}
      </div>
      <div className="px-3 py-2.5 space-y-1 text-[11px]">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <p>
      <span className="text-gray-500">{label}: </span>
      <span className="font-semibold text-gray-900">{value?.trim() || "—"}</span>
    </p>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-right font-semibold px-1.5 py-2 whitespace-nowrap align-middle">
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className = "",
}: {
  children: ReactNode;
  align?: "right" | "left";
  className?: string;
}) {
  return (
    <td
      className={`px-1.5 py-1.5 align-middle ${className}`}
      style={{ textAlign: align === "right" ? "right" : undefined }}
    >
      {children}
    </td>
  );
}

function PctCell({ value, blue }: { value: number; blue: string }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="flex flex-col gap-0.5 min-w-[52px]">
      <span className="font-semibold whitespace-nowrap">
        {formatPercent(value)}
      </span>
      <div
        className="h-[4px] w-full overflow-hidden"
        style={{ background: "#e5e7eb" }}
      >
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: blue }}
        />
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function SignCol({
  label,
  value,
  line,
}: {
  label: string;
  value: string;
  line?: boolean;
}) {
  return (
    <div>
      <p className="text-gray-500 mb-2">{label}</p>
      {line ? (
        <div className="h-10 border-b border-gray-400" />
      ) : (
        <p className="font-semibold min-h-[40px] border-b border-gray-300 pb-1">
          {value}
        </p>
      )}
    </div>
  );
}
