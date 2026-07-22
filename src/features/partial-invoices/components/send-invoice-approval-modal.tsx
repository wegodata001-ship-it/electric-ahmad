"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Badge } from "@/components/ui";
import { invoiceService } from "@/features/partial-invoices/services/invoice.service";
import { Search } from "lucide-react";

export type InvoiceApproverRow = Awaited<
  ReturnType<typeof invoiceService.listApprovers>
>[number];

type Props = {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  onSent: (result: {
    whatsappUrl: string | null;
    emailUrl: string | null;
  }) => void;
  onError: (message: string) => void;
};

export function SendInvoiceApprovalModal({
  open,
  onClose,
  invoiceId,
  onSent,
  onError,
}: Props) {
  const [approvers, setApprovers] = useState<InvoiceApproverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [createTask, setCreateTask] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    setQuery("");
    setRoleFilter("all");
    setDeptFilter("all");
    setCreateTask(true);
    setNotifyInApp(true);
    setSendWhatsApp(false);
    setSendEmail(false);
    setLoading(true);
    let cancelled = false;
    invoiceService
      .listApprovers()
      .then((items) => {
        if (!cancelled) setApprovers(items);
      })
      .catch((e) => {
        if (!cancelled) {
          onError(e instanceof Error ? e.message : "שגיאה בטעינת מנהלים");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const roles = useMemo(
    () => [...new Set(approvers.map((a) => a.roleLabel))].sort(),
    [approvers]
  );
  const departments = useMemo(
    () => [...new Set(approvers.map((a) => a.department))].sort(),
    [approvers]
  );

  const filtered = useMemo(() => {
    return approvers.filter((a) => {
      if (roleFilter !== "all" && a.roleLabel !== roleFilter) return false;
      if (deptFilter !== "all" && a.department !== deptFilter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.includes(q)
      );
    });
  }, [approvers, query, roleFilter, deptFilter]);

  const selected = useMemo(
    () => approvers.filter((a) => selectedIds.includes(a.id)),
    [approvers, selectedIds]
  );

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!selectedIds.length) {
      onError("יש לבחור לפחות מנהל אחד");
      return;
    }
    setSubmitting(true);
    try {
      const hasPhone = selected.some((s) => s.phone);
      const hasEmail = selected.some((s) => s.email);
      const result = await invoiceService.sendForApproval(invoiceId, {
        approverUserIds: selectedIds,
        createTask,
        notifyInApp,
        sendWhatsApp: sendWhatsApp && hasPhone,
        sendEmail: sendEmail && hasEmail,
      });
      onSent(result.channels);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : "שגיאה בשליחה לאישור");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="בחירת מנהלים לאישור החשבון"
      description="ניתן לבחור מנהל אחד או יותר בעלי הרשאת אישור — השליחה תתבצע לכולם"
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-xl border border-gray-200 py-2 pr-9 pl-3 text-sm"
              placeholder="חיפוש לפי שם…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">כל התפקידים</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">כל המחלקות</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 py-8 text-center">טוען מנהלים…</p>
        ) : !filtered.length ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            לא נמצאו מנהלים מתאימים
          </p>
        ) : (
          <div className="overflow-auto rounded-xl border border-gray-200 max-h-[280px]">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-right w-10" />
                  <th className="px-3 py-2 text-right">שם מלא</th>
                  <th className="px-3 py-2 text-right">תפקיד</th>
                  <th className="px-3 py-2 text-right">מחלקה</th>
                  <th className="px-3 py-2 text-right">טלפון</th>
                  <th className="px-3 py-2 text-right">אימייל</th>
                  <th className="px-3 py-2 text-right">סטטוס</th>
                  <th className="px-3 py-2 text-right">ממתינים</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const checked = selectedIds.includes(a.id);
                  return (
                    <tr
                      key={a.id}
                      className={`border-t border-gray-50 cursor-pointer ${
                        checked ? "bg-primary-50/60" : "hover:bg-gray-50"
                      }`}
                      onClick={() => toggle(a.id)}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(a.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">
                        {a.fullName}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{a.roleLabel}</td>
                      <td className="px-3 py-2.5 text-gray-600">{a.department}</td>
                      <td className="px-3 py-2.5 dir-ltr text-left text-gray-600">
                        {a.phone || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 truncate max-w-[140px]">
                        {a.email || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          className={
                            a.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-gray-50 text-gray-500 border-gray-200"
                          }
                        >
                          {a.statusLabel}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {a.pendingApprovals > 0 ? (
                          <span className="inline-flex min-w-6 justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            {a.pendingApprovals}
                          </span>
                        ) : (
                          <span className="text-gray-300">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selected.length > 0 && (
          <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-4 space-y-3">
            <p className="text-sm font-semibold text-primary-900">
              נבחרו {selected.length} מנהלים:{" "}
              {selected.map((s) => s.fullName).join(", ")}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={createTask}
                  onChange={(e) => setCreateTask(e.target.checked)}
                />
                יצירת משימת אישור במערכת
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={notifyInApp}
                  onChange={(e) => setNotifyInApp(e.target.checked)}
                />
                שליחת התראה בתוך המערכת
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sendWhatsApp}
                  onChange={(e) => setSendWhatsApp(e.target.checked)}
                />
                שליחת WhatsApp (למנהל הראשון עם טלפון)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                />
                שליחת Email (למנהל הראשון עם אימייל)
              </label>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            ביטול
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!selectedIds.length || submitting}
          >
            שלח לאישור ({selectedIds.length || 0})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
