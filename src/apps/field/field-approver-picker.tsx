"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { field } from "@/apps/field/field-ui";
import { cn } from "@/lib/utils";

export type ApproverOption = {
  id: string;
  name: string;
  role?: string | null;
  roleLabel?: string;
  group?: "system" | "operations" | "project";
};

const GROUP_LABEL: Record<string, string> = {
  system: "מנהל מערכת",
  operations: "מנהל תפעול",
  project: "מנהל פרויקט",
};

/**
 * Mobile-first multi-select of document approvers.
 * Any selected person can approve alone (any-one rule on the server).
 */
export function FieldApproverPicker({
  open,
  projectId,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  projectId?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (approverIds: string[]) => void;
}) {
  const [items, setItems] = useState<ApproverOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setError("");
    setLoading(true);
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    apiClient
      .get<{ items: ApproverOption[] }>(`/api/field/approvers${q}`)
      .then((d) => setItems(d.items || []))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "שגיאה בטעינת מאשרים")
      )
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const grouped = useMemo(() => {
    const order = ["system", "operations", "project"] as const;
    return order
      .map((g) => ({
        key: g,
        label: GROUP_LABEL[g],
        items: items.filter((i) => (i.group || "system") === g),
      }))
      .filter((g) => g.items.length > 0);
  }, [items]);

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-xl">
        <h2 className="text-2xl font-black text-[#111827]">שלח לאישור</h2>
        <p className="mt-2 text-base text-[#6B7280]">
          בחרו מנהל אחד או יותר. מספיק שאישור אחד יאשר.
        </p>

        {error && <p className={cn(field.error, "mt-3")}>{error}</p>}
        {loading && (
          <p className="mt-6 text-center text-base text-[#6B7280]">טוען מאשרים…</p>
        )}

        {!loading && !items.length && (
          <p className="mt-6 text-center text-base text-[#6B7280]">
            לא נמצאו מאשרים זמינים
          </p>
        )}

        <div className="mt-4 space-y-5">
          {grouped.map((g) => (
            <div key={g.key} className="space-y-2">
              <p className="text-sm font-bold text-slate-500">{g.label}</p>
              {g.items.map((a) => {
                const on = selected.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    className={cn(
                      "flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 text-right",
                      on
                        ? "border-emerald-600 bg-emerald-50"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                        on
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300"
                      )}
                    >
                      {on && <Check className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-black text-slate-900">
                        {a.name}
                      </span>
                      <span className="block text-sm text-slate-500">
                        {a.roleLabel || a.role}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={busy || !selected.length}
            onClick={() => onConfirm(selected)}
            className={cn(field.btnSuccess, "min-h-16 text-xl")}
          >
            {busy ? "שולח…" : `שלח לאישור (${selected.length})`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={field.btnGhost}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
