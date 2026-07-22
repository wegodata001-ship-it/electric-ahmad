"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Receipt } from "lucide-react";
import { Button, Badge, useToast } from "@/components/ui";
import { formatCurrency } from "@/utils/format";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@/constants";
import { invoicesWorkspaceService } from "@/features/partial-invoices/services/invoices-workspace.service";
import type { InvoiceStatus } from "@/types";

const GROUPS: { key: string; title: string; match: (s: string) => boolean }[] = [
  { key: "draft", title: "טיוטות חשבון", match: (s) => s === "draft" },
  {
    key: "pending",
    title: "ממתינים לאישור",
    match: (s) => s === "pending_foreman_approval",
  },
  {
    key: "approved",
    title: "מאושרים",
    match: (s) => s === "approved_by_foreman" || s === "approved",
  },
  {
    key: "sent",
    title: "נשלחו ללקוח",
    match: (s) => s === "sent_to_client" || s === "signed",
  },
  { key: "paid", title: "שולמו", match: (s) => s === "paid" },
];

export function ProjectInvoicesPage({
  projectId,
  embedded = false,
}: {
  projectId: string;
  embedded?: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [tree, setTree] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [createFolder, setCreateFolder] = useState(true);

  function reload() {
    return Promise.all([
      invoicesWorkspaceService.getTree(projectId),
      invoicesWorkspaceService.getSummary(projectId),
    ]).then(([t, s]) => {
      setTree(t);
      setSummary(s);
    });
  }

  useEffect(() => {
    reload()
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function generate() {
    setGenerating(true);
    try {
      const result = await invoicesWorkspaceService.generateInvoice({
        projectId,
        createDocumentFolder: createFolder,
      });
      toast.success(`טיוטת חשבון ${result.invoice.invoiceNumber} נוצרה`);
      router.push(`/invoices/${result.invoice.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="p-6 text-sm text-gray-500">טוען…</p>;

  const invoices = tree?.invoices ?? [];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {!embedded && (
            <Link href={`/invoices?projectId=${projectId}`} className="text-gray-500">
              <ArrowRight className="h-5 w-5" />
            </Link>
          )}
          <div>
            <h2 className={embedded ? "text-lg font-bold" : "text-xl font-bold"}>
              חשבונות הפרויקט
            </h2>
            <p className="text-sm text-gray-500">
              חיוב רק על כמויות שבוצעו ועדיין לא חויבו · מניעת כפל
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={createFolder}
              onChange={(e) => setCreateFolder(e.target.checked)}
            />
            צור תיקיית מסמכים
          </label>
          <Button
            onClick={generate}
            disabled={generating || !summary?.billableLines?.length}
          >
            <Receipt className="h-4 w-4" />
            {generating ? "מפיק…" : "הפק חשבון"}
          </Button>
        </div>
      </div>

      {summary && (
        <div className="rounded-2xl border border-primary-100 bg-primary-50/40 p-4">
          <p className="text-sm text-primary-800">
            מוכן לחיוב:{" "}
            <strong>{summary.billableLines?.length ?? 0}</strong> סעיפים ·{" "}
            <strong>{formatCurrency(summary.subtotal ?? 0)}</strong>
          </p>
          <Link
            href={`/invoices/projects/${projectId}/summary`}
            className="text-sm font-semibold text-primary-700 mt-1 inline-block"
          >
            הצג ריכוז מלא לפני הפקה
          </Link>
        </div>
      )}

      {GROUPS.map((g) => {
        const items = invoices.filter((i: any) => g.match(i.status));
        return (
          <section key={g.key} className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="font-bold text-gray-900 mb-3">
              {g.title}{" "}
              <span className="text-sm font-normal text-gray-400">({items.length})</span>
            </h2>
            {!items.length && (
              <p className="text-sm text-gray-400">אין פריטים בקבוצה זו</p>
            )}
            <div className="space-y-2">
              {items.map((inv: any) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-3 hover:bg-gray-50"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{inv.invoiceNumber}</p>
                    <Badge
                      className={
                        INVOICE_STATUS_COLORS[inv.status as InvoiceStatus] ?? ""
                      }
                    >
                      {INVOICE_STATUS_LABELS[inv.status as InvoiceStatus] ?? inv.status}
                    </Badge>
                  </div>
                  <p className="font-bold text-sm">
                    {formatCurrency(inv.totalWithVat ?? inv.amount)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
