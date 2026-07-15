"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fieldService } from "@/features/field/services/field.service";
import type { FieldCrewMember } from "@/types";
import { ConfirmationDialog, useToast } from "@/components/ui";
import { Trash2 } from "lucide-react";

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
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
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

  function startEdit(m: FieldCrewMember) {
    setEditingId(m.id);
    setForm({
      name: m.name,
      phone: m.phone,
      profession: m.profession,
      status: m.status,
      notes: m.notes,
    });
    setShowForm(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await fieldService.updateCrewMember(editingId, form);
      } else {
        await fieldService.createCrewMember(form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      reload();
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

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">עובדים שלי</h1>
          <p className="text-base text-gray-500 mt-1">
            רשימה אישית · בלי Login · לבחירה ביומן העבודה
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
            setShowForm(true);
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

      {showForm && (
        <form
          onSubmit={onSave}
          className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3"
        >
          <p className="text-lg font-bold">
            {editingId ? "עריכת עובד" : "עובד חדש"}
          </p>
          <input
            required
            placeholder="שם *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base"
          />
          <input
            placeholder="טלפון (אופציונלי)"
            value={form.phone}
            dir="ltr"
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base"
          />
          <input
            placeholder="מקצוע"
            value={form.profession}
            onChange={(e) =>
              setForm((f) => ({ ...f, profession: e.target.value }))
            }
            className="w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base"
          />
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base"
          >
            <option value="active">פעיל</option>
            <option value="inactive">לא פעיל</option>
          </select>
          <textarea
            placeholder="הערות"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full min-h-20 border border-gray-300 rounded-xl px-3.5 py-3 text-base"
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
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="h-14 px-5 rounded-2xl border border-gray-300 font-semibold"
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      {/* Mobile cards */}
      <div className="space-y-3 lg:hidden">
        {list.map((m) => (
          <div
            key={m.id}
            className="rounded-2xl bg-white border border-gray-200 p-4"
          >
            <div className="flex justify-between gap-2">
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
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => startEdit(m)}
                className="flex-1 h-12 rounded-xl border border-gray-300 font-semibold"
              >
                ערוך
              </button>
              <button
                type="button"
                onClick={() => setDeleteId(m.id)}
                className="flex-1 h-12 rounded-xl border border-red-200 text-red-600 font-semibold"
              >
                מחק
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-right px-4 py-3">שם</th>
              <th className="text-right px-4 py-3">טלפון</th>
              <th className="text-right px-4 py-3">מקצוע</th>
              <th className="text-right px-4 py-3">סטטוס</th>
              <th className="text-right px-4 py-3">הערות</th>
              <th className="text-right px-4 py-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-semibold">{m.name}</td>
                <td className="px-4 py-3" dir="ltr">
                  {m.phone || "—"}
                </td>
                <td className="px-4 py-3">{m.profession || "—"}</td>
                <td className="px-4 py-3">
                  {m.status === "active" ? "פעיל" : "לא פעיל"}
                </td>
                <td className="px-4 py-3 text-gray-500">{m.notes || "—"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-[#1e40af] font-medium ml-3"
                    onClick={() => startEdit(m)}
                  >
                    ערוך
                  </button>
                  <button
                    type="button"
                    className="text-red-600 font-medium"
                    onClick={() => setDeleteId(m.id)}
                  >
                    מחק
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {list.length === 0 && !showForm && (
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
