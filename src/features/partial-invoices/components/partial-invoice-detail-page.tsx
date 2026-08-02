"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { invoiceService } from "@/features/partial-invoices/services/invoice.service";
import type { PartialInvoice, ProjectInvoiceApproval } from "@/types";
import { Badge, Button, Card, Progress } from "@/components/ui";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "@/utils/format";
import {
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  INVOICE_FOREMAN_BADGE_LABELS,
} from "@/constants";
import {
  ArrowRight,
  Printer,
  FileText,
  Pencil,
  Send,
  CheckCircle2,
} from "lucide-react";
import { SendInvoiceApprovalModal } from "./send-invoice-approval-modal";

const CAN_SEND_FOR_APPROVAL = new Set([
  "draft",
  "rejected_by_foreman",
  "rejected",
]);

export function PartialInvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<PartialInvoice | null>(null);
  const [approvals, setApprovals] = useState<ProjectInvoiceApproval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingSent, setMarkingSent] = useState(false);
  const [showApproverModal, setShowApproverModal] = useState(false);
  /** Only System Manager may mark invoice as sent to client */
  const [canSendToClient, setCanSendToClient] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        const role = j?.data?.role ?? j?.role;
        setCanSendToClient(
          role === "SYSTEM_MANAGER" ||
            role === "ADMIN" ||
            role === "admin" ||
            role === "מנהל מערכת"
        );
      })
      .catch(() => undefined);
  }, []);

  const reload = useCallback(async () => {
    const [inv, apps] = await Promise.all([
      invoiceService.getById(invoiceId),
      invoiceService.getApprovals(invoiceId),
    ]);
    setInvoice(inv);
    setApprovals(apps);
  }, [invoiceId]);

  useEffect(() => {
    reload().catch((err) =>
      setError(err instanceof Error ? err.message : "שגיאה בטעינת החשבון")
    );
  }, [reload]);

  async function handleMarkSentToClient() {
    setActionError(null);
    setMarkingSent(true);
    try {
      await invoiceService.markSentToClient(invoiceId);
      await reload();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "שגיאה בסימון כנשלח ללקוח"
      );
    } finally {
      setMarkingSent(false);
    }
  }

  function handleApprovalSent(channels: {
    whatsappUrl: string | null;
    emailUrl: string | null;
  }) {
    setActionError(null);
    if (channels.whatsappUrl) window.open(channels.whatsappUrl, "_blank");
    if (channels.emailUrl) window.open(channels.emailUrl, "_blank");
    void reload();
  }

  if (error) {
    return (
      <Card padding="lg">
        <p className="text-sm text-red-600">{error}</p>
        <Button
          className="mt-3"
          variant="secondary"
          onClick={() => router.push("/invoices")}
        >
          חזרה
        </Button>
      </Card>
    );
  }

  if (!invoice) {
    return <p className="text-sm text-gray-400">טוען חשבון...</p>;
  }

  const foremanBadge = INVOICE_FOREMAN_BADGE_LABELS[invoice.status];
  const canSend = CAN_SEND_FOR_APPROVAL.has(invoice.status);
  const canMarkSent =
    invoice.status === "approved_by_foreman" && canSendToClient;
  const latestApproval = approvals[0];

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap print:hidden">
        <div>
          <button
            onClick={() => router.push("/invoices")}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה לחשבונות
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              חשבון מספר {invoice.sequenceNumber}
            </h1>
            <Badge className={INVOICE_STATUS_COLORS[invoice.status]}>
              {foremanBadge ?? INVOICE_STATUS_LABELS[invoice.status]}
            </Badge>
            {foremanBadge && (
              <span className="text-xs text-gray-400">
                {INVOICE_STATUS_LABELS[invoice.status]}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            חודש {invoice.billingMonth} · {invoice.projectName}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canSend && (
            <Button onClick={() => setShowApproverModal(true)}>
              <Send className="h-4 w-4" />
              שלח לאישור
            </Button>
          )}
          {canMarkSent && (
            <Button
              variant="secondary"
              onClick={handleMarkSentToClient}
              loading={markingSent}
            >
              <CheckCircle2 className="h-4 w-4" />
              סמן כנשלח ללקוח
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() =>
              window.open(`/print/invoices/${invoice.id}?download=1`, "_blank")
            }
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              window.open(`/print/invoices/${invoice.id}`, "_blank")
            }
          >
            <Printer className="h-4 w-4" />
            הדפסה
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/invoices/${invoice.id}/edit`)}
          >
            <Pencil className="h-4 w-4" />
            עריכה
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {actionError}
        </div>
      )}

      {invoice.status === "pending_foreman_approval" && (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          החשבון ממתין לאישור
          {latestApproval?.managerName
            ? ` אצל ${latestApproval.managerName}`
            : ""}
          {latestApproval?.senderName
            ? ` · נשלח ע״י ${latestApproval.senderName}`
            : ""}
          {latestApproval?.sentAt
            ? ` · ${formatDateTime(latestApproval.sentAt)}`
            : ""}
          .
        </div>
      )}

      {latestApproval?.status === "rejected" && latestApproval.comment && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <span className="font-medium">הערת דחייה: </span>
          {latestApproval.comment}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="md">
          <p className="text-xs text-gray-500">סכום</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {formatCurrency(invoice.amount)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500">תאריך</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {formatDate(invoice.date)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500">למי מוציאים</p>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {invoice.billTo || "—"}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-gray-500">קבלן</p>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {invoice.contractor || "—"}
          </p>
        </Card>
      </div>

      {approvals.length > 0 && (
        <Card padding="lg">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            היסטוריית אישורים
          </h2>
          <div className="space-y-2">
            {approvals.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 text-sm py-2 border-b border-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {a.status === "pending" && "ממתין לאישור"}
                    {a.status === "approved" && "אושר"}
                    {a.status === "rejected" && "נדחה"}
                    {a.status === "cancelled" && "בוטל"}
                    {a.managerName ? ` · מאשר: ${a.managerName}` : ""}
                    {a.senderName ? ` · נשלח ע״י: ${a.senderName}` : ""}
                  </p>
                  {a.comment && (
                    <p className="text-gray-500 mt-0.5">{a.comment}</p>
                  )}
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {a.sentAt ? formatDateTime(a.sentAt) : "—"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">פירוט סעיפים</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-gray-50/80 text-xs text-gray-500">
              <tr>
                <th className="text-right px-3 py-3">סעיף</th>
                <th className="text-right px-3 py-3">תיאור</th>
                <th className="text-right px-3 py-3">יחידה</th>
                <th className="text-right px-3 py-3">כמות חוזה</th>
                <th className="text-right px-3 py-3">מצטברת קודם</th>
                <th className="text-right px-3 py-3">כמות נוכחית</th>
                <th className="text-right px-3 py-3">מצטברת אחרי</th>
                <th className="text-right px-3 py-3">% כמותי</th>
                <th className="text-right px-3 py-3">מחיר יחידה</th>
                <th className="text-right px-3 py-3">סכום נוכחי</th>
                <th className="text-right px-3 py-3">סכום מצטבר</th>
                <th className="text-right px-3 py-3">% כספי</th>
              </tr>
            </thead>
            <tbody>
              {invoice.includedItems.map((item) => (
                <tr
                  key={item.boqItemId + item.code}
                  className="border-t border-gray-50"
                >
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">
                    {item.code}
                  </td>
                  <td className="px-3 py-2">{item.description}</td>
                  <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                  <td className="px-3 py-2">
                    {formatNumber(item.contractQuantity)}
                  </td>
                  <td className="px-3 py-2">
                    {formatNumber(item.previousQuantity)}
                  </td>
                  <td className="px-3 py-2 font-medium text-primary-700">
                    {formatNumber(item.quantity)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Progress
                        value={item.quantityPercent}
                        size="sm"
                        className="w-12"
                      />
                      <span className="text-xs">
                        {formatPercent(item.quantityPercent)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {formatCurrency(item.total)}
                  </td>
                  <td className="px-3 py-2">
                    {formatCurrency(item.cumulativeAmount)}
                  </td>
                  <td className="px-3 py-2">
                    {formatPercent(item.financialPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {invoice.notes && (
          <div className="px-5 py-4 border-t border-gray-100 text-sm text-gray-600">
            הערות: {invoice.notes}
          </div>
        )}
      </Card>

      <SendInvoiceApprovalModal
        open={showApproverModal}
        onClose={() => setShowApproverModal(false)}
        invoiceId={invoiceId}
        onSent={handleApprovalSent}
        onError={setActionError}
      />
    </div>
  );
}
