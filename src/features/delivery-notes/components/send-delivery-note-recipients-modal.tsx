"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Badge } from "@/components/ui";
import { deliveryNoteService } from "@/features/delivery-notes/services/delivery-note.service";
import { Search } from "lucide-react";

type Recipient = Awaited<
  ReturnType<typeof deliveryNoteService.listRecipients>
>["items"][number];

type Props = {
  open: boolean;
  onClose: () => void;
  noteId: string;
  projectId: string;
  clientLabel?: string;
  clientPhone?: string | null;
  onSent: (channels: {
    whatsappUrl: string | null;
    emailUrl: string | null;
  }) => void;
  onError: (message: string) => void;
};

export function SendDeliveryNoteRecipientsModal({
  open,
  onClose,
  noteId,
  projectId,
  clientLabel,
  clientPhone,
  onSent,
  onError,
}: Props) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [includeClient, setIncludeClient] = useState(false);
  const [query, setQuery] = useState("");
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    setIncludeClient(false);
    setQuery("");
    setNotifyInApp(true);
    setSendWhatsApp(false);
    setSendEmail(false);
    setLoading(true);
    let cancelled = false;
    deliveryNoteService
      .listRecipients(projectId)
      .then((res) => {
        if (!cancelled) setRecipients(res.items);
      })
      .catch((e) => {
        if (!cancelled) {
          onError(e instanceof Error ? e.message : "שגיאה בטעינת נמענים");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return recipients;
    const q = query.trim().toLowerCase();
    return recipients.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.roleLabel.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.includes(q)
    );
  }, [recipients, query]);

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!selectedIds.length && !includeClient) {
      onError("יש לבחור לפחות נמען אחד");
      return;
    }
    setSubmitting(true);
    try {
      const result = await deliveryNoteService.send(noteId, {
        recipientIds: selectedIds,
        includeClient,
        notifyInApp,
        sendWhatsApp,
        sendEmail,
      });
      if (result.channels.whatsappUrl) {
        window.open(result.channels.whatsappUrl, "_blank");
      }
      if (result.channels.emailUrl) {
        window.open(result.channels.emailUrl, "_blank");
      }
      onSent(result.channels);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : "שגיאה בשליחה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="למי תרצה לשלוח את תעודת המשלוח?"
      description="ניתן לבחור מנהל פרויקט, מנהל עבודה, לקוח ומשתמשים נוספים — גם במקביל"
      size="xl"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-xl border border-gray-200 py-2 pr-9 pl-3 text-sm"
            placeholder="חיפוש נמען…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={includeClient}
            onChange={(e) => setIncludeClient(e.target.checked)}
          />
          <span>
            לקוח
            {clientLabel ? ` — ${clientLabel}` : ""}
            {clientPhone ? (
              <span className="text-gray-500" dir="ltr">
                {" "}
                ({clientPhone})
              </span>
            ) : (
              <span className="text-xs text-gray-400"> (אין טלפון בתעודה)</span>
            )}
          </span>
        </label>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">טוען נמענים…</p>
        ) : !filtered.length ? (
          <p className="py-8 text-center text-sm text-gray-500">לא נמצאו נמענים</p>
        ) : (
          <div className="max-h-[280px] overflow-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="w-10 px-3 py-2 text-right" />
                  <th className="px-3 py-2 text-right">שם</th>
                  <th className="px-3 py-2 text-right">תפקיד</th>
                  <th className="px-3 py-2 text-right">טלפון</th>
                  <th className="px-3 py-2 text-right">אימייל</th>
                  <th className="px-3 py-2 text-right">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const checked = selectedIds.includes(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={`cursor-pointer border-t border-gray-50 ${
                        checked ? "bg-primary-50/60" : "hover:bg-gray-50"
                      }`}
                      onClick={() => toggle(r.id)}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(r.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium">{r.fullName}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.roleLabel}</td>
                      <td className="px-3 py-2.5 text-left text-gray-600" dir="ltr">
                        {r.phone || "—"}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2.5 text-gray-600">
                        {r.email || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          className={
                            r.status === "active"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-gray-200 bg-gray-50 text-gray-500"
                          }
                        >
                          {r.status === "active" ? "פעיל" : "לא פעיל"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={notifyInApp}
              onChange={(e) => setNotifyInApp(e.target.checked)}
            />
            שליחה במערכת
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={sendWhatsApp}
              onChange={(e) => setSendWhatsApp(e.target.checked)}
            />
            WhatsApp
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Email
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            ביטול
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            loading={submitting}
            disabled={submitting || (!selectedIds.length && !includeClient)}
          >
            שלח ({selectedIds.length + (includeClient ? 1 : 0)})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
