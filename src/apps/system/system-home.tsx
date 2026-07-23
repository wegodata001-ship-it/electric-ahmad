"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";

export function SystemHome() {
  const [stats, setStats] = useState({
    projects: 0,
    workflowPending: 0,
    notifications: 0,
    shareLinks: 0,
  });

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/projects").then((r) => r.json()),
      apiClient.get<{ items: unknown[] }>("/api/workflow/pending"),
      apiClient.get<unknown[]>("/api/notifications"),
      apiClient.get<{ items: unknown[] }>("/api/share-links"),
    ]).then(([p, w, n, s]) => {
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
        <h1 className="text-3xl font-black tracking-tight text-white">
          מרכז השליטה
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          מידע · שליטה · Audit · Workflow · Documents — Portal להנהלה
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="פרויקטים / חברות" value={stats.projects} href="/system/companies" />
        <Tile label="Workflow ממתינים" value={stats.workflowPending} href="/system/workflow" hot />
        <Tile label="התראות שלא נקראו" value={stats.notifications} href="/system/notifications" />
        <Tile label="Share Links" value={stats.shareLinks} href="/system/share-links" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Panel href="/system/users" title="Users & Permissions" desc="משתמשים, מנהלי עבודה, עובדים" />
        <Panel href="/system/workflow" title="Workflow Engine" desc="תור אישורים ומעברי סטטוס" />
        <Panel href="/system/documents" title="Documents Hub" desc="ארכיון מסמכים ארגוני" />
        <Panel href="/system/whatsapp" title="WhatsApp Hub" desc="Internal / External (תשתית)" />
        <Panel href="/system/share-links" title="Share Links" desc="קישורי לקוח וחתימה" />
        <Panel href="/system/settings" title="Settings" desc="הגדרות מערכת" />
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
          ? "rounded-2xl bg-cyan-500 px-4 py-5 text-slate-950"
          : "rounded-2xl border border-white/10 bg-slate-900 px-4 py-5"
      }
    >
      <p className="text-3xl font-black">{value}</p>
      <p className={`mt-1 text-xs font-bold ${hot ? "text-slate-800" : "text-slate-400"}`}>
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
      className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-4 hover:border-cyan-500/40"
    >
      <p className="font-black text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{desc}</p>
    </Link>
  );
}
