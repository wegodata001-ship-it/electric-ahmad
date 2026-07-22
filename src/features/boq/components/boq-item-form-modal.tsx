"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Input } from "@/components/ui";
import type { BoqItem, BoqItemKind, BoqItemStatus } from "@/types";
import { formatCurrency } from "@/utils/format";

export type BoqItemFormValues = {
  code: string;
  description: string;
  unit: string;
  contractQuantity: string;
  unitPrice: string;
  category: string;
  notes: string;
  itemKind: BoqItemKind;
  status: BoqItemStatus;
  exceptionalChecked: boolean;
};

const emptyValues = (forceExceptional = false): BoqItemFormValues => ({
  code: "",
  description: "",
  unit: "יח'",
  contractQuantity: "",
  unitPrice: "",
  category: "",
  notes: "",
  itemKind: forceExceptional ? "exceptional" : "regular",
  status: "active",
  exceptionalChecked: forceExceptional,
});

function fromItem(item: BoqItem): BoqItemFormValues {
  return {
    code: item.code ?? "",
    description: item.description ?? "",
    unit: item.unit ?? "יח'",
    contractQuantity: String(item.contractQuantity ?? ""),
    unitPrice: String(item.unitPrice ?? ""),
    category: item.category ?? "",
    notes: item.notes ?? "",
    itemKind: item.itemKind ?? "regular",
    status: (["active", "pending", "cancelled", "completed"].includes(item.status)
      ? item.status
      : "active") as BoqItemStatus,
    exceptionalChecked: item.itemKind === "exceptional",
  };
}

interface BoqItemFormModalProps {
  open: boolean;
  mode: "create-exceptional" | "edit";
  item?: BoqItem | null;
  onClose: () => void;
  onSubmit: (values: {
    code: string | null;
    description: string;
    unit: string;
    contractQuantity: number;
    unitPrice: number;
    category: string | null;
    notes: string | null;
    itemKind: BoqItemKind;
    status: BoqItemStatus;
  }) => Promise<void>;
}

export function BoqItemFormModal({
  open,
  mode,
  item,
  onClose,
  onSubmit,
}: BoqItemFormModalProps) {
  const [values, setValues] = useState<BoqItemFormValues>(emptyValues(true));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (mode === "edit" && item) setValues(fromItem(item));
    else setValues(emptyValues(true));
  }, [open, mode, item]);

  const total = useMemo(() => {
    const qty = Number(values.contractQuantity) || 0;
    const price = Number(values.unitPrice) || 0;
    return qty * price;
  }, [values.contractQuantity, values.unitPrice]);

  function patch<K extends keyof BoqItemFormValues>(key: K, value: BoqItemFormValues[K]) {
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === "exceptionalChecked") {
        next.itemKind = value ? "exceptional" : "regular";
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!values.description.trim()) {
      setError("יש להזין תיאור");
      return;
    }
    const contractQuantity = Number(values.contractQuantity);
    const unitPrice = Number(values.unitPrice);
    if (Number.isNaN(contractQuantity) || contractQuantity < 0) {
      setError("כמות לא תקינה");
      return;
    }
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      setError("מחיר יחידה לא תקין");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        code: values.code.trim() || null,
        description: values.description.trim(),
        unit: values.unit.trim() || "יח'",
        contractQuantity,
        unitPrice,
        category: values.category.trim() || null,
        notes: values.notes.trim() || null,
        itemKind: values.exceptionalChecked ? "exceptional" : values.itemKind,
        status: values.status,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "edit" ? "עריכת סעיף" : "הוסף סעיף חריג";

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
        {error && (
          <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-gray-500">קוד סעיף {mode === "create-exceptional" ? "(אופציונלי)" : ""}</span>
            <Input
              className="mt-1"
              value={values.code}
              onChange={(e) => patch("code", e.target.value)}
              placeholder="לדוגמה EX-01"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-500">יחידה</span>
            <Input
              className="mt-1"
              value={values.unit}
              onChange={(e) => patch("unit", e.target.value)}
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-gray-500">תיאור</span>
          <textarea
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm min-h-24"
            value={values.description}
            onChange={(e) => patch("description", e.target.value)}
            required
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="text-gray-500">כמות</span>
            <Input
              className="mt-1"
              inputMode="decimal"
              value={values.contractQuantity}
              onChange={(e) => patch("contractQuantity", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-500">מחיר יחידה</span>
            <Input
              className="mt-1"
              inputMode="decimal"
              value={values.unitPrice}
              onChange={(e) => patch("unitPrice", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-500">סה״כ</span>
            <div className="mt-1 h-10 flex items-center rounded-xl border border-gray-100 bg-gray-50 px-3 text-sm font-semibold">
              {formatCurrency(total)}
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-gray-500">קטגוריה</span>
            <Input
              className="mt-1"
              value={values.category}
              onChange={(e) => patch("category", e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-500">סטטוס</span>
            <select
              className="mt-1 w-full h-10 rounded-xl border border-gray-200 px-3 text-sm"
              value={values.status}
              onChange={(e) => patch("status", e.target.value as BoqItemStatus)}
            >
              <option value="active">פעיל</option>
              <option value="pending">ממתין</option>
              <option value="cancelled">בוטל</option>
              <option value="completed">הושלם</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-gray-500">הערות</span>
          <textarea
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm min-h-20"
            value={values.notes}
            onChange={(e) => patch("notes", e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={values.exceptionalChecked}
            onChange={(e) => patch("exceptionalChecked", e.target.checked)}
          />
          סעיף חריג
        </label>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "שומר…" : "שמור"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
