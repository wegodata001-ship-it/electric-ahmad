"use client";

import { useEffect, useState } from "react";
import { invoiceService } from "@/features/partial-invoices/services/invoice.service";
import type { PartialInvoice } from "@/types";
import { Card, Badge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/utils/format";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/constants";
import { Receipt, ChevronDown, ChevronUp } from "lucide-react";

export function PartialInvoicesPage() {
  const [invoices, setInvoices] = useState<PartialInvoice[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    invoiceService.getAll().then(setInvoices);
  }, []);

  const filtered =
    filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  const totalAmount = filtered.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">חשבונות חלקיים</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} חשבונות · סה״כ {formatCurrency(totalAmount)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {["all", "draft", "submitted", "approved", "paid", "rejected"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {f === "all" ? "הכל" : INVOICE_STATUS_LABELS[f as keyof typeof INVOICE_STATUS_LABELS]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((invoice) => (
          <Card key={invoice.id} padding="none">
            <button
              className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors text-right"
              onClick={() => setExpanded(expanded === invoice.id ? null : invoice.id)}
            >
              <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Receipt className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{invoice.invoiceNumber}</p>
                  <Badge className={INVOICE_STATUS_COLORS[invoice.status]}>
                    {INVOICE_STATUS_LABELS[invoice.status]}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{invoice.projectName}</p>
              </div>
              <div className="text-left">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(invoice.amount)}</p>
                <p className="text-xs text-gray-400">{formatDate(invoice.date)}</p>
              </div>
              {expanded === invoice.id ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {expanded === invoice.id && (
              <div className="px-5 pb-5 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-900 mt-4 mb-3">סעיפים כלולים</h4>
                <div className="space-y-2">
                  {invoice.includedItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-gray-50">
                      <div>
                        <span className="font-mono text-gray-500 text-xs ml-2">{item.code}</span>
                        <span className="text-gray-900">{item.description}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-gray-500">{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                        <span className="font-medium text-gray-900 mr-3">{formatCurrency(item.total)}</span>
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
