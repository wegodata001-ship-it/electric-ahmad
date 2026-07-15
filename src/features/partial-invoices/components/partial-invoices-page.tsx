"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { invoiceService } from "@/features/partial-invoices/services/invoice.service";
import type { PartialInvoice } from "@/types";
import { Card, Badge, Button, Progress } from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/format";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  INVOICE_FOREMAN_BADGE_LABELS,
} from "@/constants";
import type { InvoiceStatus } from "@/types";
import {
  Receipt,
  ChevronDown,
  ChevronUp,
  Plus,
  Eye,
  Printer,
  FileText,
} from "lucide-react";

export function PartialInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<PartialInvoice[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    invoiceService.getAll().then(setInvoices);
  }, []);

  const filtered =
    filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  const totalAmount = filtered.reduce((s, i) => s + i.amount, 0);
  const paidAmount = filtered
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">חשבונות</h1>
          <p className="text-sm text-gray-500 mt-1">
            חשבונות חלקיים ועתידיים · {filtered.length} · סה״כ{" "}
            {formatCurrency(totalAmount)}
          </p>
        </div>
        <Button onClick={() => router.push("/invoices/new")}>
          <Plus className="h-4 w-4" />
          חשבון חדש
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md">
          <p className="text-xs text-gray-500">סה״כ חשבונות</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{filtered.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500">סכום כולל</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {formatCurrency(totalAmount)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500">שולם</p>
          <p className="text-xl font-bold text-primary-700 mt-1">
            {formatCurrency(paidAmount)}
          </p>
          <Progress
            value={totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0}
            size="sm"
            className="mt-2"
          />
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(
          [
            "all",
            "draft",
            "pending_foreman_approval",
            "approved_by_foreman",
            "rejected_by_foreman",
            "sent_to_client",
            "paid",
          ] as const
        ).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {f === "all"
              ? "הכל"
              : INVOICE_STATUS_LABELS[f as InvoiceStatus]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card padding="lg">
            <p className="text-sm text-gray-400 text-center">
              אין חשבונות חלקיים. צרו חשבון חדש מכתב הכמויות.
            </p>
          </Card>
        )}

        {filtered.map((invoice) => (
          <Card key={invoice.id} padding="none">
            <div className="flex items-center gap-4 p-5">
              <button
                className="flex items-center gap-4 flex-1 min-w-0 text-right hover:opacity-90"
                onClick={() =>
                  setExpanded(expanded === invoice.id ? null : invoice.id)
                }
              >
                <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Receipt className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">
                      חשבון {invoice.sequenceNumber}
                    </p>
                    <span className="text-xs text-gray-400 font-mono">
                      {invoice.invoiceNumber}
                    </span>
                    <Badge className={INVOICE_STATUS_COLORS[invoice.status]}>
                      {INVOICE_FOREMAN_BADGE_LABELS[invoice.status] ??
                        INVOICE_STATUS_LABELS[invoice.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {invoice.projectName} · חודש {invoice.billingMonth || "—"}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(invoice.amount)}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(invoice.date)}</p>
                </div>
                {expanded === invoice.id ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  title="צפייה"
                  onClick={() => router.push(`/invoices/${invoice.id}`)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="PDF"
                  onClick={() =>
                    window.open(
                      `/print/invoices/${invoice.id}?download=1`,
                      "_blank"
                    )
                  }
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="הדפסה"
                  onClick={() =>
                    window.open(`/print/invoices/${invoice.id}`, "_blank")
                  }
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {expanded === invoice.id && (
              <div className="px-5 pb-5 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-900 mt-4 mb-3">
                  סעיפים כלולים
                </h4>
                <div className="space-y-2">
                  {invoice.includedItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm py-2 border-b border-gray-50 gap-3"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-gray-500 text-xs ml-2">
                          {item.code}
                        </span>
                        <span className="text-gray-900">{item.description}</span>
                      </div>
                      <div className="text-left whitespace-nowrap">
                        <span className="text-gray-500">
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </span>
                        <span className="font-medium text-gray-900 mr-3">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
