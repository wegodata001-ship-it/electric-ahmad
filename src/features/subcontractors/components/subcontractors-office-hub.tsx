"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  FileText,
  HardHat,
  Plus,
  Wallet,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui";
import { BrandLogo } from "@/components/brand/brand-logo";
import { CreateContractorWizard } from "./create-contractor-wizard";

type Summary = {
  activeContractors: number;
  withoutUser: number;
  inProgressWorks: number;
  pendingReports: number;
  pendingAccounts: number;
  projectsWithContractors: number;
  payableBalance: number;
};

type Item = {
  id: string;
  code: string;
  companyName: string;
  contactName: string;
  phone: string;
  status: string;
  userStatus: string;
  userStatusLabel: string;
  activeAssignments: number;
  openWorks: number;
  payableBalance: number;
};

export function SubcontractorsOfficeHub({
  cardHref = "/system/subcontractors",
}: {
  cardHref?: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [userStatus, setUserStatus] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [wizard, setWizard] = useState(false);

  const filtersActive = Boolean(q.trim() || status || userStatus || projectId);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      if (userStatus) params.set("userStatus", userStatus);
      if (projectId) params.set("projectId", projectId);
      const data = await apiClient.get<{ items: Item[]; summary: Summary }>(
        `/api/subcontractors?${params}`
      );
      setItems(data.items);
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    apiClient
      .get<Array<{ id: string; name: string }> | { items?: Array<{ id: string; name: string }> }>(
        "/api/projects"
      )
      .then((r) => setProjects(Array.isArray(r) ? r : r.items ?? []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userStatus, projectId]);

  const noContractors =
    !loading &&
    !filtersActive &&
    items.length === 0 &&
    (summary?.activeContractors ?? 0) === 0;
  const canAssignExisting = (summary?.activeContractors ?? 0) > 0 || items.length > 0;
  const assignHref = items[0] ? `${cardHref}/${items[0].id}#assign` : `${cardHref}`;

  return (
    <div className="space-y-5 overflow-x-hidden" dir="rtl">
      <section
        className="overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-white shadow-[0_8px_24px_rgba(17,17,17,0.04)]"
        style={{
          background:
            "linear-gradient(135deg, #ffffff 0%, #fff7f8 42%, #f6f7f8 100%)",
        }}
      >
        <div className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="min-w-0">
            <BrandLogo height={48} maxWidth={180} />
            <h1 className="mt-4 text-2xl font-black text-[var(--brand-text)]">
              ניהול קבלני משנה
            </h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--brand-text-muted)]">
              ניהול קבלנים, פרויקטים, עבודות, מדידות וחשבונות במקום אחד.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${cardHref}/inbox`}
              className="inline-flex min-h-11 items-center rounded-xl border border-[var(--brand-border)] bg-white px-4 text-sm font-bold"
            >
              דיווחים ממתינים
            </Link>
            <Button onClick={() => setWizard(true)}>+ הוסף קבלן משנה</Button>
          </div>
        </div>
      </section>

      {summary && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Stat icon={HardHat} label="קבלנים פעילים" value={summary.activeContractors} />
          <Stat
            icon={Building2}
            label="פרויקטים עם קבלנים"
            value={summary.projectsWithContractors}
          />
          <Stat icon={Briefcase} label="עבודות בביצוע" value={summary.inProgressWorks} />
          <Stat icon={FileText} label="דיווחים ממתינים" value={summary.pendingReports} />
          <Stat icon={Wallet} label="חשבונות ממתינים" value={summary.pendingAccounts} />
        </div>
      )}

      <div className="grid gap-2 rounded-2xl border border-[var(--brand-border)] bg-white p-3 shadow-sm sm:grid-cols-4">
        <input
          className="rounded-xl border border-[var(--brand-border)] px-3 py-2.5 text-sm"
          placeholder="חיפוש לפי שם, טלפון, ח.פ..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
        />
        <select
          className="rounded-xl border border-[var(--brand-border)] px-3 py-2.5 text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">כל הפרויקטים</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-[var(--brand-border)] px-3 py-2.5 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="inactive">לא פעיל</option>
        </select>
        <select
          className="rounded-xl border border-[var(--brand-border)] px-3 py-2.5 text-sm"
          value={userStatus}
          onChange={(e) => setUserStatus(e.target.value)}
        >
          <option value="">כל משתמשי הגישה</option>
          <option value="none">ללא משתמש</option>
          <option value="active">יש משתמש</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && noContractors && (
        <div className="rounded-3xl border border-[var(--brand-border)] bg-white px-6 py-14 text-center shadow-sm">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "var(--brand-primary-soft)", color: "var(--brand-primary)" }}
          >
            <HardHat className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-xl font-black text-[var(--brand-text)]">
            עדיין לא נוספו קבלני משנה
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--brand-text-muted)]">
            הוסיפו קבלן משנה ראשון, הקצו אותו לפרויקט והתחילו לנהל עבודות ודיווחים.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button onClick={() => setWizard(true)}>
              <Plus className="h-4 w-4" />
              הוסף קבלן משנה
            </Button>
            {canAssignExisting && (
              <Link
                href={assignHref}
                className="inline-flex min-h-11 items-center rounded-xl border border-[var(--brand-border)] bg-white px-4 text-sm font-medium"
              >
                הקצה קבלן קיים לפרויקט
              </Link>
            )}
          </div>
        </div>
      )}

      {!loading && !items.length && !noContractors && (
        <div className="rounded-2xl border border-dashed border-[var(--brand-border)] p-10 text-center text-sm text-[var(--brand-text-muted)]">
          אין קבלני משנה לפי הסינון הנוכחי
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-[var(--brand-border)] bg-white p-4 shadow-[0_6px_18px_rgba(17,17,17,0.04)]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black">
                  {item.companyName}{" "}
                  <span className="font-mono text-xs font-normal text-slate-400">{item.code}</span>
                </p>
                <p className="mt-1 text-sm text-[var(--brand-text-muted)]">
                  {item.contactName} · {item.phone}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {item.activeAssignments} פרויקטים פעילים
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">{item.userStatusLabel}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">{item.openWorks} עבודות פתוחות</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">
                    יתרה {item.payableBalance.toLocaleString("he-IL")} ₪
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`${cardHref}/${item.id}`}
                  className="rounded-xl px-3 py-2 text-xs font-bold text-white"
                  style={{ background: "var(--brand-primary)" }}
                >
                  פתח כרטיס
                </Link>
                <Link href={`${cardHref}/${item.id}#assign`} className="rounded-xl border border-[var(--brand-border)] px-3 py-2 text-xs font-bold">
                  הקצה פרויקט
                </Link>
                <Link href={`${cardHref}/${item.id}#access`} className="rounded-xl border border-[var(--brand-border)] px-3 py-2 text-xs font-bold">
                  ניהול גישה
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {wizard && (
        <CreateContractorWizard
          cardHref={cardHref}
          onClose={() => {
            setWizard(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof HardHat;
}) {
  return (
    <div className="rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4 shadow-[0_6px_18px_rgba(17,17,17,0.04)]">
      <div className="flex items-center gap-2 text-[var(--brand-primary)]">
        <Icon className="h-4 w-4" />
        <p className="text-[11px] font-semibold text-[var(--brand-text-muted)]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black text-[var(--brand-text)]">{value}</p>
    </div>
  );
}
