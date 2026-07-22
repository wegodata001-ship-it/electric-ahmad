"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import {
  workDiariesService,
  type WorkDiaryListItem,
} from "../services/work-diaries.service";

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  revision: "טיוטה לתיקון",
  pending_approval: "ממתין לאישור",
  in_approval: "בתהליך אישור",
  approved: "אושר",
  sent_to_client: "נשלח ללקוח",
  signed: "נחתם",
  completed: "הושלם",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  revision: "bg-amber-100 text-amber-800",
  pending_approval: "bg-blue-100 text-blue-800",
  in_approval: "bg-indigo-100 text-indigo-800",
  approved: "bg-emerald-100 text-emerald-800",
  sent_to_client: "bg-cyan-100 text-cyan-800",
  signed: "bg-green-100 text-green-900",
  completed: "bg-slate-200 text-slate-800",
};

export function WorkDiariesListPage() {
  const [items, setItems] = useState<WorkDiaryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    workDiariesService
      .list()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#03142F]">יומן עבודה</h1>
          <p className="text-sm text-gray-500 mt-1">יצירה, שליחה לאישור ומעקב סטטוס</p>
        </div>
        <Link
          href="/field/work-diaries/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#1e40af] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          יומן חדש
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-500">טוען…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !items.length && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 font-medium text-gray-600">אין יומני עבודה</p>
          <Link
            href="/field/work-diaries/new"
            className="mt-4 inline-flex text-sm font-semibold text-[#1e40af]"
          >
            צור יומן ראשון
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/field/work-diaries/${item.id}`}
            className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-[#1e40af]/40 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-[#03142F]">{item.documentNumber}</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {item.project?.name ?? "ללא פרויקט"}
                  {item.clientName ? ` · ${item.clientName}` : ""}
                </p>
                <p className="text-xs text-gray-400 mt-1">{item.workDate}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[item.status] ?? "bg-gray-100"}`}
              >
                {STATUS_LABEL[item.status] ?? item.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
