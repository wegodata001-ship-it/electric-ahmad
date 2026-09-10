"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, FilePlus2, Truck } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  DRIVER_DN_STATUS_LABEL,
  driverDnStatusTone,
} from "@/apps/driver/driver-dn-status";

type Row = {
  id: string;
  documentNumber: string;
  status: string;
  noteDate: string;
  clientName: string;
  address?: string | null;
  project?: { id: string; name: string } | null;
};

export function DriverDnList() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get<{ items: Row[] }>("/api/driver/delivery-notes")
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFF7ED] text-[#EA580C]">
              <Truck className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-black text-[#0F172A]">
              תעודות משלוח שלי
            </h1>
          </div>
          <p className="mt-1 text-sm text-[#64748B]">
            כל התעודות והסטטוס העדכני שלהן
          </p>
        </div>
        <Link
          href="/driver/delivery-notes/new"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#059669] px-3.5 text-sm font-bold text-white"
        >
          <FilePlus2 className="h-4 w-4" />
          חדשה
        </Link>
      </div>

      {loading && (
        <p className="text-center text-sm text-[#64748B]">טוען…</p>
      )}
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && items.length === 0 && (
        <p className="rounded-3xl border border-dashed border-[#DCE4EF] bg-white py-10 text-center text-sm text-[#64748B]">
          עדיין אין תעודות
        </p>
      )}

      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.id}>
            <Link
              href={`/driver/delivery-notes/${row.id}`}
              className="block rounded-2xl border border-[#DCE4EF] border-s-4 border-s-[#EA580C] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-black text-[#0F172A]">
                    {row.documentNumber}
                  </p>
                  <p className="mt-2 truncate text-sm font-semibold text-[#334155]">
                    {row.project?.name || "ללא פרויקט"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#64748B]">
                    {row.address || row.clientName}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${driverDnStatusTone(row.status)}`}
                >
                  {DRIVER_DN_STATUS_LABEL[row.status] || row.status}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#E8EEF6] pt-3">
                <p className="text-xs text-[#64748B]">
                  {new Date(row.noteDate).toLocaleDateString("he-IL")}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB]">
                  <Eye className="h-4 w-4" />
                  צפייה
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
