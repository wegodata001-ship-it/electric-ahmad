"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-black">תעודות משלוח שלי</h1>
        <Link
          href="/driver/delivery-notes/new"
          className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
        >
          חדשה
        </Link>
      </div>

      {loading && <p className="text-center text-sm text-slate-400">טוען…</p>}
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {!loading && items.length === 0 && (
        <p className="rounded-3xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          עדיין אין תעודות
        </p>
      )}

      <ul className="space-y-3">
        {items.map((row) => (
          <li key={row.id}>
            <Link
              href={`/driver/delivery-notes/${row.id}`}
              className="block rounded-3xl border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black text-slate-900">
                    {row.documentNumber}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {row.project?.name || "ללא פרויקט"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {row.address || row.clientName}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${driverDnStatusTone(row.status)}`}
                >
                  {DRIVER_DN_STATUS_LABEL[row.status] || row.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">{row.noteDate}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
