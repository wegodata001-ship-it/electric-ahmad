"use client";

import { useEffect, useState } from "react";

export function OpsWorkers() {
  const [foremen, setForemen] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/foremen").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ])
      .then(([fm, emp]) => {
        const fRaw = fm?.data ?? fm;
        const eRaw = emp?.data ?? emp;
        setForemen(Array.isArray(fRaw) ? fRaw : fRaw?.items || []);
        setEmployees(Array.isArray(eRaw) ? eRaw : eRaw?.items || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black">עובדים</h2>
        <p className="mt-1 text-sm text-stone-500">
          מנהלי עבודה וצוותים — לבחירה בסידור
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-black text-amber-800">מנהלי עבודה</h3>
        {foremen.map((f) => (
          <div
            key={f.id}
            className="rounded-2xl bg-white px-4 py-3 ring-1 ring-amber-200"
          >
            <p className="font-bold">
              {f.name || `${f.firstName ?? ""} ${f.lastName ?? ""}`.trim()}
            </p>
            <p className="text-xs text-stone-500">{f.phone || f.email || ""}</p>
          </div>
        ))}
        {foremen.length === 0 && (
          <p className="text-sm text-stone-400">אין מנהלי עבודה</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-black text-amber-800">עובדים</h3>
        {employees.slice(0, 40).map((e) => (
          <div
            key={e.id}
            className="rounded-2xl bg-white px-4 py-3 ring-1 ring-amber-200"
          >
            <p className="font-bold">
              {e.name || `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim()}
            </p>
            <p className="text-xs text-stone-500">{e.role || e.phone || ""}</p>
          </div>
        ))}
        {employees.length === 0 && (
          <p className="text-sm text-stone-400">אין עובדים</p>
        )}
      </section>
    </div>
  );
}
