"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";

export function SystemHome() {
  const [stats, setStats] = useState({
    projects: 0,
    approvalsPending: 0,
    workflowPending: 0,
    notifications: 0,
    shareLinks: 0,
  });

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/projects").then((r) => r.json()),
      apiClient.get<{ items: unknown[]; count?: number }>("/api/approvals/revisions"),
      apiClient.get<{ items: unknown[] }>("/api/workflow/pending"),
      apiClient.get<unknown[]>("/api/notifications"),
      apiClient.get<{ items: unknown[] }>("/api/share-links"),
    ]).then(([p, a, w, n, s]) => {
      setStats((prev) => {
        const next = { ...prev };
        if (p.status === "fulfilled") {
          const raw = p.value?.data ?? p.value;
          const list = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.items)
              ? raw.items
              : [];
          next.projects = list.length;
        }
        if (a.status === "fulfilled")
          next.approvalsPending = a.value.count ?? a.value.items?.length ?? 0;
        if (w.status === "fulfilled") next.workflowPending = w.value.items.length;
        if (n.status === "fulfilled") {
          const rows = Array.isArray(n.value) ? n.value : [];
          next.notifications = rows.filter((x: any) => !x.read).length;
        }
        if (s.status === "fulfilled") next.shareLinks = s.value.items.length;
        return next;
      });
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          מרכז השליטה
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          מידע · שליטה · בקרה · תהליכי עבודה · מסמכים — ממשק הנהלה
        </p>
      </div>

      <Link
        href="/system/approvals"
        className={
          stats.approvalsPending > 0
            ? "block rounded-3xl bg-amber-500 px-5 py-6 text-slate-900 shadow-sm"
            : "block rounded-3xl border-2 border-slate-200 bg-white px-5 py-6 shadow-sm"
        }
      >
        <p className="text-sm font-bold">מרכז תיקונים</p>
        <p className="mt-1 text-3xl font-black">
          תיקונים ({stats.approvalsPending})
        </p>
        <p className="mt-2 text-sm opacity-80">
          מסמכים שהוחזרו לתיקון — פתיחה ישירה לעריכה
        </p>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="פרויקטים / חברות" value={stats.projects} href="/system/companies" />
        <Tile label="תהליכים ממתינים" value={stats.workflowPending} href="/system/workflow" hot />
        <Tile label="התראות שלא נקראו" value={stats.notifications} href="/system/notifications" />
        <Tile label="קישורי שיתוף" value={stats.shareLinks} href="/system/share-links" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Panel href="/system/approvals" title="מרכז תיקונים" desc="דפים שחזרו לתיקון · פתח ותקן" />
        <Panel href="/system/users" title="משתמשים והרשאות" desc="משתמשים, מנהלי עבודה, עובדים" />
        <Panel href="/system/workflow" title="מנוע תהליכים" desc="תור אישורים ומעברי סטטוס" />
        <Panel href="/system/documents" title="מרכז מסמכים" desc="ארכיון מסמכים ארגוני" />
        <Panel href="/system/whatsapp" title="מרכז וואטסאפ" desc="פנימי / חיצוני (תשתית)" />
        <Panel href="/system/share-links" title="קישורי שיתוף" desc="קישורי לקוח וחתימה" />
        <Panel href="/system/settings" title="הגדרות" desc="הגדרות מערכת" />
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  href,
  hot,
}: {
  label: string;
  value: number;
  href: string;
  hot?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        hot
          ? "rounded-2xl bg-slate-900 px-4 py-5 text-white shadow-sm"
          : "rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm"
      }
    >
      <p className="text-3xl font-black">{value}</p>
      <p className={`mt-1 text-xs font-bold ${hot ? "text-slate-300" : "text-slate-500"}`}>
        {label}
      </p>
    </Link>
  );
}

function Panel({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm hover:border-slate-400"
    >
      <p className="font-black text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
    </Link>
  );
}
