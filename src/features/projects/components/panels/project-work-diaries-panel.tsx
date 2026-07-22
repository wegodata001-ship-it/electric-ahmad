"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  revision: "טיוטה לתיקון",
  pending_approval: "ממתין לאישור",
  in_approval: "בתהליך אישור",
  approved: "אושר",
  sent_to_client: "נשלח ללקוח",
  signed: "נחתם",
  completed: "הושלם",
  closed: "נסגר",
};

export function ProjectWorkDiariesPanel({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    apiClient
      .get<{ items: any[] }>(
        `/api/documents-archive?kind=work_diary&projectId=${projectId}`
      )
      .then((r) => setItems(r.items ?? []))
      .catch((e) => setError(e.message || "שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <p className="text-sm text-gray-500">טוען…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">יומן עבודה</h2>
        <p className="text-sm text-gray-500">{items.length} מסמכים</p>
      </div>

      {!items.length && (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          אין יומני עבודה לפרויקט זה
        </p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3"
          >
            <p className="font-semibold text-sm text-gray-900">
              {item.documentNumber || item.id}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {STATUS_LABEL[item.status] ?? item.status}
              {item.workDate ? ` · ${String(item.workDate).slice(0, 10)}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
