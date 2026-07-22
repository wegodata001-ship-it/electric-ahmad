"use client";

import { Modal } from "@/components/ui";
import { useEffect, useState } from "react";
import { boqService } from "@/features/boq/services/boq.service";

interface BoqItemHistoryModalProps {
  open: boolean;
  itemId: string | null;
  onClose: () => void;
}

export function BoqItemHistoryModal({ open, itemId, onClose }: BoqItemHistoryModalProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !itemId) return;
    setLoading(true);
    setError("");
    boqService
      .getHistory(itemId)
      .then((r) => setRows(r.history))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, itemId]);

  return (
    <Modal open={open} onClose={onClose} title="היסטוריית סעיף" size="md">
      <div className="p-4 sm:p-6 space-y-3 max-h-[70vh] overflow-y-auto">
        {loading && <p className="text-sm text-gray-500">טוען…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !rows.length && (
          <p className="text-sm text-gray-500">אין היסטוריה עדיין</p>
        )}
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-gray-100 p-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">
                {row.action === "CREATE"
                  ? "יצירה"
                  : row.action === "UPDATE"
                    ? "עדכון"
                    : row.action === "DELETE"
                      ? "מחיקה"
                      : row.action}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(row.createdAt).toLocaleString("he-IL")}
              </span>
            </div>
            <p className="text-gray-600 mt-1">{row.user?.name}</p>
            {row.metadata && (
              <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap break-all bg-gray-50 rounded-lg p-2">
                {JSON.stringify(row.metadata, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
