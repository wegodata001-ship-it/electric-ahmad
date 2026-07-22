"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Receipt } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { formatCurrency, formatNumber } from "@/utils/format";
import { invoicesWorkspaceService } from "../services/invoices-workspace.service";

export function InvoiceSummaryPage({ projectId }: { projectId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createFolder, setCreateFolder] = useState(true);

  useEffect(() => {
    invoicesWorkspaceService
      .getSummary(projectId)
      .then(setSummary)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function generate() {
    setCreating(true);
    try {
      const result = await invoicesWorkspaceService.generateInvoice({
        projectId,
        sheetIds: summary?.sheetIds,
        createDocumentFolder: createFolder,
      });
      toast.success(`חשבון ${result.invoice.invoiceNumber} הופק`);
      router.push(`/invoices/${result.invoice.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p className="p-6 text-sm text-gray-500">טוען ריכוז…</p>;
  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link href={`/invoices?projectId=${projectId}`} className="text-gray-500 mt-1">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">ריכוז חשבון</h1>
          <p className="text-sm text-gray-500 mt-1">
            דפים: {summary.sheetTitles?.join(", ") || "אין דפים פתוחים"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createFolder}
              onChange={(e) => setCreateFolder(e.target.checked)}
            />
            צור תיקיית מסמכים
          </label>
          <Button onClick={generate} disabled={creating || !summary.billableLines?.length}>
            <Receipt className="h-4 w-4" />
            {creating ? "מפיק…" : "הפק חשבון"}
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-right">קוד</th>
              <th className="px-3 py-3 text-right">תיאור</th>
              <th className="px-3 py-3 text-right">יח׳</th>
              <th className="px-3 py-3 text-right">כמות חוזה</th>
              <th className="px-3 py-3 text-right">בוצע קודם</th>
              <th className="px-3 py-3 text-right">בתקופה</th>
              <th className="px-3 py-3 text-right">לחיוב</th>
              <th className="px-3 py-3 text-right">מצטבר</th>
              <th className="px-3 py-3 text-right">יתרה</th>
              <th className="px-3 py-3 text-right">סכום</th>
            </tr>
          </thead>
          <tbody>
            {summary.lines.map((l: any) => (
              <tr
                key={l.boqItemId}
                className={`border-t border-gray-50 ${
                  l.billableQuantity > 0 ? "bg-primary-50/20" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs">{l.code}</td>
                <td className="px-3 py-2 max-w-xs truncate">{l.description}</td>
                <td className="px-3 py-2">{l.unit}</td>
                <td className="px-3 py-2">{formatNumber(l.contractQuantity)}</td>
                <td className="px-3 py-2">{formatNumber(l.previousQuantity)}</td>
                <td className="px-3 py-2 font-semibold">{formatNumber(l.periodQuantity)}</td>
                <td className="px-3 py-2 font-bold text-primary-700">
                  {formatNumber(l.billableQuantity)}
                </td>
                <td className="px-3 py-2">{formatNumber(l.cumulativeQuantity)}</td>
                <td className="px-3 py-2">{formatNumber(l.remainingQuantity)}</td>
                <td className="px-3 py-2">{formatCurrency(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-gray-50 font-bold">
              <td colSpan={9} className="px-3 py-3 text-left">
                סה״כ לתשלום
              </td>
              <td className="px-3 py-3">{formatCurrency(summary.subtotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
