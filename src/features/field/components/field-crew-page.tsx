"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { fieldService } from "@/features/field/services/field.service";
import type { FieldCrewMember } from "@/types";
import { ConfirmationDialog, useToast } from "@/components/ui";
import { CrewTimesheetPanel } from "@/features/field/components/crew-timesheet-panel";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

const emptyForm = {
  name: "",
  phone: "",
  profession: "",
  status: "active",
  notes: "",
};

export function FieldCrewPage() {
  const toast = useToast();
  const [list, setList] = useState<FieldCrewMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [newForm, setNewForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function reload() {
    fieldService
      .getCrew()
      .then(setList)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      );
  }

  useEffect(() => {
    reload();
  }, []);

  function openWorker(m: FieldCrewMember) {
    if (expandedId === m.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(m.id);
    setEditForm({
      name: m.name,
      phone: m.phone,
      profession: m.profession,
      status: m.status,
      notes: m.notes,
    });
    setShowNewForm(false);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!expandedId) return;
    setSaving(true);
    setError(null);
    try {
      await fieldService.updateCrewMember(expandedId, editForm);
      toast.success("פרטי העובד נשמרו");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveNew(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await fieldService.createCrewMember(newForm);
      setShowNewForm(false);
      setNewForm(emptyForm);
      reload();
      setExpandedId(created.id);
      setEditForm({
        name: created.name,
        phone: created.phone,
        profession: created.profession,
        status: created.status,
        notes: created.notes,
      });
      toast.success("העובד נוסף");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId || deleting) return;
    setDeleting(true);
    try {
      await fieldService.deleteCrewMember(deleteId);
      if (expandedId === deleteId) setExpandedId(null);
      setDeleteId(null);
      toast.success("העובד הוסר מהרשימה");
      reload();
    } catch {
      toast.error("מחיקת העובד נכשלה", "נסה שוב בעוד מספר רגעים.");
    } finally {
      setDeleting(false);
    }
  }

  const deleteTarget = list.find((m) => m.id === deleteId);

  function renderExpanded(m: FieldCrewMember) {
    if (expandedId !== m.id) return null;
    return (
      <div className="px-4 pb-4 space-y-4 bg-[#fafbfc] border-t border-gray-100">
        <form onSubmit={onSaveEdit} className="pt-4 space-y-3">
          <p className="text-sm font-bold text-gray-700">פרטי העובד</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              required
              placeholder="שם *"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, name: e.target.value }))
              }
              className="w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base bg-white"
            />
            <input
              placeholder="טלפון"
              value={editForm.phone}
              dir="ltr"
              onChange={(e) =>
                setEditForm((f) => ({ ...f, phone: e.target.value }))
              }
              className="w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base bg-white"
            />
            <input
              placeholder="מקצוע"
              value={editForm.profession}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, profession: e.target.value }))
              }
              className="w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base bg-white"
            />
            <select
              value={editForm.status}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, status: e.target.value }))
              }
              className="w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base bg-white"
            >
              <option value="active">פעיל</option>
              <option value="inactive">לא פעיל</option>
            </select>
            <textarea
              placeholder="הערות"
              value={editForm.notes}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="sm:col-span-2 w-full min-h-16 border border-gray-300 rounded-xl px-3.5 py-3 text-base bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="h-12 px-5 rounded-xl bg-[#1e40af] text-white font-bold disabled:opacity-50"
          >
            {saving ? "שומר..." : "שמור פרטי עובד"}
          </button>
        </form>

        <CrewTimesheetPanel crewMemberId={m.id} workerName={m.name} />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">עובדים שלי</h1>
          <p className="text-base text-gray-500 mt-1">
            ניהול צוות וכרטסת שעות · בלי Login לעובדים
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpandedId(null);
            setNewForm(emptyForm);
            setShowNewForm(true);
          }}
          className="h-14 px-6 rounded-2xl bg-[#1e40af] text-white text-base font-bold"
        >
          הוסף עובד
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {showNewForm && (
        <form
          onSubmit={onSaveNew}
          className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3"
        >
          <p className="text-lg font-bold">עובד חדש</p>
          <input
            required
            placeholder="שם *"
            value={newForm.name}
            onChange={(e) =>
              setNewForm((f) => ({ ...f, name: e.target.value }))
            }
            className="w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base"
          />
          <input
            placeholder="טלפון (אופציונלי)"
            value={newForm.phone}
            dir="ltr"
            onChange={(e) =>
              setNewForm((f) => ({ ...f, phone: e.target.value }))
            }
            className="w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base"
          />
          <input
            placeholder="מקצוע"
            value={newForm.profession}
            onChange={(e) =>
              setNewForm((f) => ({ ...f, profession: e.target.value }))
            }
            className="w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-14 rounded-2xl bg-[#1e40af] text-white font-bold"
            >
              {saving ? "שומר..." : "שמור"}
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="h-14 px-5 rounded-2xl border border-gray-300 font-semibold"
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {list.map((m) => {
          const open = expandedId === m.id;
          return (
            <div
              key={m.id}
              className="rounded-2xl bg-white border border-gray-200 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => openWorker(m)}
                className="w-full text-right p-4 flex justify-between gap-2"
              >
                <div>
                  <p className="text-lg font-bold">{m.name}</p>
                  <p className="text-sm text-gray-500">
                    {m.profession || "—"} ·{" "}
                    {m.status === "active" ? "פעיל" : "לא פעיל"}
                  </p>
                  {m.phone && (
                    <p className="text-sm text-gray-400 mt-1" dir="ltr">
                      {m.phone}
                    </p>
                  )}
                </div>
                {open ? (
                  <ChevronUp className="h-5 w-5 text-gray-400 shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400 shrink-0 mt-1" />
                )}
              </button>
              <div className="flex gap-2 px-4 pb-3">
                <button
                  type="button"
                  onClick={() => openWorker(m)}
                  className="flex-1 h-12 rounded-xl border border-gray-300 font-semibold"
                >
                  {open ? "סגור" : "ערוך"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(m.id)}
                  className="flex-1 h-12 rounded-xl border border-red-200 text-red-600 font-semibold"
                >
                  מחק
                </button>
              </div>
              {renderExpanded(m)}
            </div>
          );
        })}
      </div>

      {/* Desktop table + expand */}
      <div className="hidden lg:block rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-right px-4 py-3 w-8" />
              <th className="text-right px-4 py-3">שם</th>
              <th className="text-right px-4 py-3">טלפון</th>
              <th className="text-right px-4 py-3">מקצוע</th>
              <th className="text-right px-4 py-3">סטטוס</th>
              <th className="text-right px-4 py-3">הערות</th>
              <th className="text-right px-4 py-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const open = expandedId === m.id;
              return (
                <WorkerDesktopRows
                  key={m.id}
                  m={m}
                  open={open}
                  onToggle={() => openWorker(m)}
                  onDelete={() => setDeleteId(m.id)}
                  expanded={renderExpanded(m)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {list.length === 0 && !showNewForm && (
        <p className="text-center text-gray-400 py-10 text-base">
          אין עובדים ברשימה. לחץ «הוסף עובד».
        </p>
      )}

      <ConfirmationDialog
        open={!!deleteId}
        onClose={() => {
          if (!deleting) setDeleteId(null);
        }}
        onConfirm={confirmDelete}
        loading={deleting}
        loadingLabel="מוחק..."
        variant="danger"
        icon={Trash2}
        title="מחיקת עובד"
        confirmLabel="מחק מהרשימה"
        cancelLabel="ביטול"
        description={
          <p>
            האם למחוק את{" "}
            <span className="font-semibold text-gray-900">
              {deleteTarget?.name || "העובד"}
            </span>{" "}
            מהרשימה האישית?
          </p>
        }
        info="העובד יוסר מרשימת «עובדים שלי». יומנים קודמים לא יימחקו."
      />
    </div>
  );
}

function WorkerDesktopRows({
  m,
  open,
  onToggle,
  onDelete,
  expanded,
}: {
  m: FieldCrewMember;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
  expanded: ReactNode;
}) {
  return (
    <>
      <tr
        className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50/80 ${
          open ? "bg-[#f8fafc]" : ""
        }`}
        onClick={onToggle}
      >
        <td className="px-3 py-3 text-gray-400">
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </td>
        <td className="px-4 py-3 font-semibold">{m.name}</td>
        <td className="px-4 py-3" dir="ltr">
          {m.phone || "—"}
        </td>
        <td className="px-4 py-3">{m.profession || "—"}</td>
        <td className="px-4 py-3">
          {m.status === "active" ? "פעיל" : "לא פעיל"}
        </td>
        <td className="px-4 py-3 text-gray-500">{m.notes || "—"}</td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="text-[#1e40af] font-medium ml-3"
            onClick={onToggle}
          >
            {open ? "סגור" : "ערוך"}
          </button>
          <button
            type="button"
            className="text-red-600 font-medium"
            onClick={onDelete}
          >
            מחק
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-gray-100">
          <td colSpan={7} className="p-0">
            {expanded}
          </td>
        </tr>
      )}
    </>
  );
}
