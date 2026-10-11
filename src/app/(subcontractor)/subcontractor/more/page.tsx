"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Ruler, User } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { EmptyState, PortalCard, PortalPage } from "@/apps/subcontractor/portal-ui";
import { PORTAL_ROLE_LABELS } from "@/lib/subcontractors/constants";

export default function Page() {
  const { userName, companyName, portalRole, canViewFinance, logout, loggingOut } =
    usePortalSession("subcontractor");
  const [notes, setNotes] = useState<
    Array<{ id: string; title: string; message: string; createdAt: string }>
  >([]);
  const displayName =
    companyName && !/portal-|@|cm[a-z0-9]{8}/i.test(companyName)
      ? companyName
      : userName || "קבלן משנה";

  useEffect(() => {
    let live = true;
    apiClient
      .get<{ items: Array<{ id: string; title: string; message: string; createdAt: string }> }>(
        "/api/subcontractor/notifications"
      )
      .then((r) => {
        if (live) setNotes(r.items);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  return (
    <PortalPage title="עוד" subtitle={displayName}>
      <PortalCard>
        <p className="text-sm text-[#5B6470]">
          {userName} · {PORTAL_ROLE_LABELS[portalRole || ""] || "קבלן משנה"}
        </p>
        <div className="mt-4 grid gap-2">
          <MoreLink href="/subcontractor/profile" icon={User} label="הפרופיל שלי" />
          <MoreLink href="/subcontractor/measurements" icon={Ruler} label="המדידות שלי" />
          <MoreLink href="/subcontractor/documents" icon={FileText} label="מסמכים" />
          {canViewFinance && (
            <MoreLink href="/subcontractor/finance" icon={FileText} label="חשבונות ותשלומים" />
          )}
        </div>
        <button
          type="button"
          className="mt-4 min-h-12 w-full rounded-xl border border-[#E6E8EB] font-bold text-red-700"
          onClick={() => void logout()}
          disabled={loggingOut}
        >
          יציאה
        </button>
      </PortalCard>
      <PortalCard>
        <h2 className="mb-2 font-black">התראות</h2>
        {notes.length === 0 && <EmptyState title="אין התראות" />}
        {notes.map((n) => (
          <div key={n.id} className="border-b border-[#E6E8EB] py-2 text-sm last:border-0">
            <p className="font-semibold">{n.title}</p>
            <p className="text-[#5B6470]">{n.message}</p>
            <p className="mt-1 text-[11px] text-[#5B6470]">{n.createdAt.slice(0, 10)}</p>
          </div>
        ))}
      </PortalCard>
    </PortalPage>
  );
}

function MoreLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof User;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center gap-2 rounded-xl border border-[#E6E8EB] px-3 text-sm font-bold"
    >
      <Icon className="h-4 w-4 text-[#C8102E]" />
      {label}
    </Link>
  );
}
