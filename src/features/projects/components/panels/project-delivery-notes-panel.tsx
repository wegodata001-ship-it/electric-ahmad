"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Pencil,
  Package,
  Plus,
  Printer,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { deliveryNoteService } from "@/features/delivery-notes/services/delivery-note.service";
import { DeliveryNoteForm } from "@/features/delivery-notes/components/delivery-note-form";
import { DeliveryNoteDocument } from "@/features/delivery-notes/components/delivery-note-document";
import { SendDeliveryNoteRecipientsModal } from "@/features/delivery-notes/components/send-delivery-note-recipients-modal";
import type { DeliveryNote } from "@/types";
import {
  Button,
  Card,
  ConfirmationDialog,
  Modal,
  useToast,
} from "@/components/ui";
import { formatDate } from "@/utils/format";

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  sent: "נשלח",
  delivered: "נמסר",
  cancelled: "בוטל",
  issued: "הופק",
  in_transit: "בדרך",
  locked: "הושלם",
};

function isEditable(status: string) {
  return status === "draft" || status === "issued" || status === "in_transit";
}

export function ProjectDeliveryNotesPanel({
  projectId,
}: {
  projectId: string;
}) {
  const toast = useToast();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewNote, setViewNote] = useState<DeliveryNote | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [workflowNote, setWorkflowNote] = useState<DeliveryNote | null>(null);
  const [askSend, setAskSend] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [askSaveDoc, setAskSaveDoc] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);

  function reload() {
    return deliveryNoteService.getByProject(projectId).then(setNotes);
  }

  useEffect(() => {
    setFormOpen(false);
    setEditId(null);
    setViewNote(null);
    setWorkflowNote(null);
    setAskSend(false);
    setSendOpen(false);
    setAskSaveDoc(false);
    setLoading(true);
    reload()
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (statusFilter !== "all" && n.status !== statusFilter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        n.noteNumber.toLowerCase().includes(q) ||
        (n.client || "").toLowerCase().includes(q) ||
        (n.contactName || "").toLowerCase().includes(q)
      );
    });
  }, [notes, query, statusFilter]);

  function openCreate() {
    setEditId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    setEditId(id);
    setFormOpen(true);
  }

  function openPrint(id: string) {
    window.open(`/print/delivery-notes/${id}?autoprint=1`, "_blank");
  }

  function startSendFlow(note: DeliveryNote) {
    setWorkflowNote(note);
    setSendOpen(true);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deliveryNoteService.delete(deleteId);
      toast.success("התעודה נמחקה");
      setDeleteId(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "מחיקה נכשלה");
    } finally {
      setDeleting(false);
    }
  }

  async function confirmSaveDoc() {
    if (!workflowNote) return;
    setSavingDoc(true);
    try {
      const result = await deliveryNoteService.saveDocument(workflowNote.id);
      toast.success(
        result.created
          ? "התעודה נשמרה במסמכי הפרויקט"
          : "התעודה כבר קיימת במסמכי הפרויקט"
      );
      setAskSaveDoc(false);
      setWorkflowNote(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSavingDoc(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">טוען…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">תעודות משלוח</h2>
          <p className="text-sm text-gray-500">
            {notes.length} תעודות · שמירה ← סיום ← שליחה ← מסמכי הפרויקט
          </p>
        </div>
        <Button className="min-h-11" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          תעודת משלוח חדשה
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-xl border border-gray-200 py-2.5 pr-9 pl-3 text-sm"
            placeholder="חיפוש…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">כל הסטטוסים</option>
          <option value="draft">טיוטה</option>
          <option value="locked">הושלם</option>
          <option value="sent">נשלח</option>
          <option value="delivered">נמסר</option>
        </select>
      </div>

      {!filtered.length && (
        <Card padding="lg">
          <p className="text-center text-sm text-gray-400">אין תעודות להצגה</p>
        </Card>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-3 text-right font-semibold">מספר תעודה</th>
              <th className="px-3 py-3 text-right font-semibold">תאריך</th>
              <th className="px-3 py-3 text-right font-semibold">לקוח</th>
              <th className="px-3 py-3 text-right font-semibold">סטטוס</th>
              <th className="px-3 py-3 text-right font-semibold">חתימה</th>
              <th className="px-3 py-3 text-right font-semibold">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((note) => {
              const signed = Boolean(
                note.receiverSigned || note.receiverSignatureUrl
              );
              const editable = isEditable(note.status);
              return (
                <tr
                  key={note.id}
                  className="border-t border-gray-50 hover:bg-gray-50/80"
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 shrink-0 text-orange-600" />
                      <span className="font-semibold text-gray-900">
                        {note.noteNumber}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    {formatDate(note.date)}
                  </td>
                  <td className="px-3 py-3 text-gray-700">{note.client}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {STATUS_LABEL[note.status] || note.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`text-xs font-semibold ${
                        signed ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {signed ? "נחתם" : "לא נחתם"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <IconBtn
                        label="צפייה"
                        onClick={async () => {
                          try {
                            setViewNote(
                              await deliveryNoteService.getById(note.id)
                            );
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "שגיאה"
                            );
                          }
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </IconBtn>
                      {editable && (
                        <IconBtn label="עריכה" onClick={() => openEdit(note.id)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </IconBtn>
                      )}
                      <IconBtn label="הדפסה" onClick={() => openPrint(note.id)}>
                        <Printer className="h-3.5 w-3.5" />
                      </IconBtn>
                      {(note.status === "locked" || note.status === "sent") && (
                        <IconBtn
                          label="שליחה"
                          onClick={() => startSendFlow(note)}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </IconBtn>
                      )}
                      {editable && (
                        <IconBtn
                          label="מחיקה"
                          danger
                          onClick={() => setDeleteId(note.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editId ? "עריכת תעודת משלוח" : "תעודת משלוח חדשה"}
        description="שמור במהלך העבודה · בסיום לחצו סיימתי תעודת משלוח"
        size="full"
      >
        <DeliveryNoteForm
          key={editId || "new"}
          projectId={projectId}
          noteId={editId}
          onCancel={() => setFormOpen(false)}
          onSaved={async (note) => {
            setEditId(note.id);
            await reload();
          }}
          onCompleted={async (note) => {
            setFormOpen(false);
            setEditId(null);
            await reload();
            setWorkflowNote(note);
            setAskSend(true);
          }}
        />
      </Modal>

      <Modal
        open={Boolean(viewNote)}
        onClose={() => setViewNote(null)}
        title={viewNote ? `תעודה ${viewNote.noteNumber}` : "צפייה"}
        size="full"
      >
        {viewNote && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {isEditable(viewNote.status) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewNote(null);
                    openEdit(viewNote.id);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  עריכה
                </Button>
              )}
              <Button onClick={() => openPrint(viewNote.id)}>
                <Printer className="h-4 w-4" />
                הדפסה
              </Button>
              {(viewNote.status === "locked" || viewNote.status === "sent") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewNote(null);
                    startSendFlow(viewNote);
                  }}
                >
                  <Send className="h-4 w-4" />
                  שליחה
                </Button>
              )}
            </div>
            <div className="overflow-auto rounded-xl border border-gray-100 bg-[#eef1f5] p-2">
              <DeliveryNoteDocument note={viewNote} />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationDialog
        open={askSend}
        onClose={() => {
          setAskSend(false);
          setWorkflowNote(null);
        }}
        onConfirm={() => {
          setAskSend(false);
          setSendOpen(true);
        }}
        title="שליחת תעודת משלוח"
        description="למי תרצה לשלוח את תעודת המשלוח?"
        confirmLabel="בחירת נמענים"
        cancelLabel="לא עכשיו"
        variant="primary"
      />

      {workflowNote && (
        <SendDeliveryNoteRecipientsModal
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          noteId={workflowNote.id}
          projectId={projectId}
          clientLabel={workflowNote.client}
          clientPhone={workflowNote.phone}
          onSent={async () => {
            toast.success("התעודה נשלחה");
            setSendOpen(false);
            await reload();
            setAskSaveDoc(true);
          }}
          onError={(m) => toast.error(m)}
        />
      )}

      <ConfirmationDialog
        open={askSaveDoc}
        onClose={() => {
          setAskSaveDoc(false);
          setWorkflowNote(null);
        }}
        onConfirm={() => void confirmSaveDoc()}
        title="שמירה במסמכים"
        description="האם לשמור את תעודת המשלוח במסמכי הפרויקט? (תיקיית תעודות משלוח)"
        confirmLabel="כן"
        cancelLabel="לא"
        loading={savingDoc}
        loadingLabel="שומר…"
        variant="primary"
      />

      <ConfirmationDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        title="מחיקת תעודת משלוח"
        description="הפעולה בלתי הפיכה. למחוק את התעודה?"
        confirmLabel="מחק"
        loading={deleting}
        loadingLabel="מוחק…"
        variant="danger"
      />
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-gray-200 text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
