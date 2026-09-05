"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";

export function ProjectHome() {
  const [projects, setProjects] = useState<any[]>([]);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((json) => {
        const raw = json?.data ?? json;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items)
            ? raw.items
            : [];
        setProjects(list.slice(0, 8));
      })
      .catch(() => undefined);

    apiClient
      .get<{ items: unknown[] }>("/api/approvals/pending")
      .then((d) => setPending(d.items.length))
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">הפרויקטים שלי</h1>
        <p className="mt-1 text-sm text-slate-500">
          התקדמות · חשבונות · חריגות · מסמכים — בלי ניהול מערכת
        </p>
      </div>

      <Link
        href="/project/approvals"
        className={
          pending > 0
            ? "block rounded-3xl bg-amber-500 px-5 py-5 text-slate-900 shadow-sm"
            : "block rounded-3xl border-2 border-slate-200 bg-white px-5 py-5 shadow-sm"
        }
      >
        <p className="text-sm font-bold">מרכז אישורים</p>
        <p className="mt-1 text-2xl font-black">🔔 ממתין לאישור ({pending})</p>
      </Link>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="פרויקטים פעילים" value={projects.length} />
        <Stat label="ממתינים לאישור / חריגות" value={pending} hot />
        <Link
          href="/project/accounts"
          className="rounded-2xl bg-blue-600 px-4 py-4 text-white"
        >
          <p className="text-sm font-bold text-blue-100">חשבונות</p>
          <p className="mt-2 text-lg font-black">מעבר לחשבונות →</p>
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">פרויקטים</h2>
          <Link href="/project/projects" className="text-sm font-bold text-blue-700">
            הכל
          </Link>
        </div>
        {projects.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
            אין פרויקטים להצגה
          </p>
        )}
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/project/projects/${p.id}`}
            className="block rounded-2xl border border-slate-200 bg-white px-4 py-4"
          >
            <p className="font-black text-slate-900">{p.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {p.location || p.contractor || p.contractNumber}
              {typeof p.progress === "number" ? ` · ${Math.round(p.progress)}%` : ""}
            </p>
          </Link>
        ))}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Quick href="/project/boq" title="כתב כמויות" />
        <Quick href="/project/documents" title="מסמכים" />
        <Quick href="/project/delivery-notes" title="תעודות משלוח" />
        <Quick href="/project/approvals" title="חריגות / אישורים" />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hot,
}: {
  label: string;
  value: number;
  hot?: boolean;
}) {
  return (
    <div
      className={
        hot
          ? "rounded-2xl bg-amber-500 px-4 py-4 text-white"
          : "rounded-2xl border border-slate-200 bg-white px-4 py-4"
      }
    >
      <p className="text-3xl font-black">{value}</p>
      <p className={`mt-1 text-xs font-bold ${hot ? "text-amber-50" : "text-slate-500"}`}>
        {label}
      </p>
    </div>
  );
}

function Quick({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-800"
    >
      {title} →
    </Link>
  );
}
