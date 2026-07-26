"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { invoicesWorkspaceService } from "@/features/partial-invoices/services/invoices-workspace.service";

export type ProjectRoomDto = {
  id: string;
  name: string;
  floor?: string | null;
  code?: string | null;
  sortOrder: number;
  isHidden?: boolean;
  hasReports?: boolean;
};

type Props = {
  projectId: string;
  disabled?: boolean;
  /** אחרי שינוי חדרים — רענון מקומי של הטבלה בלי reload מלא */
  onChanged: () => void | Promise<void>;
};

const emptyForm = {
  name: "",
  floor: "",
  code: "",
  sortOrder: "",
};

/**
 * ניהול חדרים דינמי מעל טבלת הביצוע (גם Desktop וגם Mobile).
 */
export function ProjectRoomsToolbar({ projectId, disabled, onChanged }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<ProjectRoomDto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [rooms, setRooms] = useState<ProjectRoomDto[]>([]);
  const [manageOpen, setManageOpen] = useState(false);

  async function refreshRooms() {
    const r = await invoicesWorkspaceService.listRooms(projectId, true);
    setRooms(r.items ?? []);
  }

  useEffect(() => {
    if (manageOpen) {
      void refreshRooms().catch((e) => toast.error(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manageOpen, projectId]);

  function openCreate() {
    setEditRoom(null);
    setForm(emptyForm);
    setOpen(true);
  }

  /** Excel-style: add room immediately, no modal */
  async function quickAddRoom() {
    if (disabled || saving) return;
    setSaving(true);
    try {
      const n = rooms.length || (await invoicesWorkspaceService.listRooms(projectId)).items?.length || 0;
      await invoicesWorkspaceService.createRoom(projectId, {
        name: `חדר ${n + 1}`,
      });
      toast.success("חדר נוסף — ניתן לשנות את השם בניהול חדרים");
      await onChanged();
      if (manageOpen) await refreshRooms();
    } catch (e: any) {
      toast.error(e?.message || "לא ניתן להוסיף חדר");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(room: ProjectRoomDto) {
    setEditRoom(room);
    setForm({
      name: room.name,
      floor: room.floor ?? "",
      code: room.code ?? "",
      sortOrder: String(room.sortOrder ?? ""),
    });
    setOpen(true);
  }

  async function saveForm() {
    if (!form.name.trim()) {
      toast.error("שם החדר חובה");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        floor: form.floor.trim() || null,
        code: form.code.trim() || null,
        sortOrder: form.sortOrder.trim()
          ? Number(form.sortOrder)
          : null,
      };
      if (editRoom) {
        await invoicesWorkspaceService.updateRoom(
          projectId,
          editRoom.id,
          payload
        );
        toast.success("החדר עודכן");
      } else {
        await invoicesWorkspaceService.createRoom(projectId, payload);
        toast.success("חדר נוסף");
      }
      setOpen(false);
      await onChanged();
      if (manageOpen) await refreshRooms();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function hideRoom(room: ProjectRoomDto) {
    try {
      await invoicesWorkspaceService.updateRoom(projectId, room.id, {
        isHidden: !room.isHidden,
      });
      toast.success(room.isHidden ? "החדר הוצג מחדש" : "החדר הוסתר");
      await onChanged();
      await refreshRooms();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function deleteRoom(room: ProjectRoomDto) {
    if (room.hasReports) {
      toast.error(
        "לא ניתן למחוק חדר שכבר קיימים עבורו דיווחי ביצוע. ניתן להסתיר אותו בלבד."
      );
      return;
    }
    if (!window.confirm(`למחוק את החדר "${room.name}"?`)) return;
    try {
      await invoicesWorkspaceService.deleteRoom(projectId, room.id);
      toast.success("החדר נמחק");
      await onChanged();
      await refreshRooms();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function move(room: ProjectRoomDto, dir: "up" | "down") {
    try {
      await invoicesWorkspaceService.updateRoom(projectId, room.id, {
        move: dir,
      });
      await onChanged();
      await refreshRooms();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => void quickAddRoom()}
          disabled={disabled || saving}
        >
          <Plus className="h-4 w-4" />
          {saving ? "מוסיף…" : "+ הוסף חדר"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={openCreate}
          disabled={disabled}
        >
          חדר מפורט
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setManageOpen(true)}
          disabled={disabled}
        >
          ניהול חדרים
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editRoom ? "עריכת חדר" : "הוספת חדר"}
      >
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              שם החדר *
            </span>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="לדוגמה: חדר 104 / לובי / מחסן"
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">קומה</span>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={form.floor}
              onChange={(e) =>
                setForm((f) => ({ ...f, floor: e.target.value }))
              }
              placeholder="אופציונלי"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              קוד חדר
            </span>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="אופציונלי"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              סדר תצוגה
            </span>
            <input
              type="number"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={form.sortOrder}
              onChange={(e) =>
                setForm((f) => ({ ...f, sortOrder: e.target.value }))
              }
              placeholder="אופציונלי"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button onClick={() => void saveForm()} disabled={saving}>
              {saving ? "שומר…" : "שמירה"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="ניהול חדרים"
      >
        <div className="max-h-[60vh] space-y-2 overflow-auto">
          {!rooms.length && (
            <p className="text-sm text-gray-500">אין חדרים עדיין</p>
          )}
          {rooms.map((room) => (
            <div
              key={room.id}
              className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${
                room.isHidden
                  ? "border-dashed border-gray-200 bg-gray-50 opacity-70"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {room.name}
                  {room.code ? (
                    <span className="ms-2 font-mono text-xs text-gray-400">
                      {room.code}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500">
                  {room.floor ? `קומה ${room.floor} · ` : ""}
                  סדר {room.sortOrder}
                  {room.hasReports ? " · יש דיווחים" : ""}
                  {room.isHidden ? " · מוסתר" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void move(room, "up")}
                  title="הזז למעלה"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void move(room, "down")}
                  title="הזז למטה"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(room)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void hideRoom(room)}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void deleteRoom(room)}
                  disabled={!!room.hasReports}
                  title={
                    room.hasReports
                      ? "לא ניתן למחוק חדר עם דיווחים"
                      : "מחיקה"
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <Button className="mt-2 w-full" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            הוסף חדר
          </Button>
        </div>
      </Modal>
    </>
  );
}
