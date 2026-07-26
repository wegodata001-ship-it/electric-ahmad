"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckSquare,
  ClipboardList,
  FileText,
  Link2,
  NotebookPen,
  Package,
  PenLine,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { notificationService } from "@/features/notifications/services/notification.service";
import { cn } from "@/lib/utils";

type Counts = {
  woOpen: number;
  woActive: number;
  woDone: number;
  diaryDraft: number;
  diaryPending: number;
  diaryApproved: number;
  dnDraft: number;
  dnPending: number;
  dnDelivered: number;
  documents: number;
  approvals: number;
  signaturesOpen: number;
  shareLinks: number;
  notifications: number;
};

function diaryBucket(status: string) {
  if (status === "draft" || status === "revision") return "draft";
  if (status === "pending_approval" || status === "in_approval") return "pending";
  return "approved";
}

function dnBucket(status: string) {
  if (status === "draft" || status === "revision") return "draft";
  if (status === "pending_approval") return "pending";
  return "delivered";
}

export function ProjectHome() {
  const [counts, setCounts] = useState<Counts>({
    woOpen: 0,
    woActive: 0,
    woDone: 0,
    diaryDraft: 0,
    diaryPending: 0,
    diaryApproved: 0,
    dnDraft: 0,
    dnPending: 0,
    dnDelivered: 0,
    documents: 0,
    approvals: 0,
    signaturesOpen: 0,
    shareLinks: 0,
    notifications: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      apiClient.get<{
        statusCounts?: {
          open?: number;
          inProgress?: number;
          done?: number;
        };
      }>("/api/work-orders"),
      apiClient.get<{ items: { status: string }[] }>("/api/work-diaries"),
      apiClient.get<{ items: { status: string }[] }>("/api/ops-delivery-notes"),
      apiClient.get<{ items: unknown[] }>("/api/approvals/pending"),
      apiClient.get<{ items: unknown[] }>("/api/documents/hub"),
      apiClient.get<{ items: any[] }>("/api/share-links"),
      notificationService.getUnread(),
    ]).then(([wo, wd, dn, ap, docs, share, n]) => {
      setCounts((prev) => {
        const next = { ...prev };
        if (wo.status === "fulfilled") {
          const sc = wo.value.statusCounts || {};
          next.woOpen = sc.open ?? 0;
          next.woActive = sc.inProgress ?? 0;
          next.woDone = sc.done ?? 0;
        }
        if (wd.status === "fulfilled") {
          for (const i of wd.value.items) {
            const b = diaryBucket(i.status);
            if (b === "draft") next.diaryDraft++;
            else if (b === "pending") next.diaryPending++;
            else next.diaryApproved++;
          }
        }
        if (dn.status === "fulfilled") {
          for (const i of dn.value.items) {
            const b = dnBucket(i.status);
            if (b === "draft") next.dnDraft++;
            else if (b === "pending") next.dnPending++;
            else next.dnDelivered++;
          }
        }
        if (ap.status === "fulfilled") next.approvals = ap.value.items.length;
        if (docs.status === "fulfilled") next.documents = docs.value.items.length;
        if (share.status === "fulfilled") {
          next.shareLinks = share.value.items.length;
          next.signaturesOpen = share.value.items.filter(
            (x) => x.status === "active"
          ).length;
        }
        if (n.status === "fulfilled") next.notifications = n.value.length;
        return next;
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">
          פעילות באתר
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          סידורים · יומנים · תעודות · אישורים — הכל במקום אחד
        </p>
      </section>

      <div className="grid gap-3">
        <ModuleCard
          href="/project/work-orders"
          icon={ClipboardList}
          title="סידורי עבודה"
          lines={[
            `${counts.woOpen} פתוחים`,
            `${counts.woActive} בביצוע`,
            `${counts.woDone} הסתיימו`,
          ]}
          primary
        />
        <ModuleCard
          href="/project/work-diaries"
          icon={NotebookPen}
          title="יומני עבודה"
          lines={[
            `${counts.diaryDraft} טיוטות`,
            `${counts.diaryPending} ממתינים לאישור`,
            `${counts.diaryApproved} מאושרים`,
          ]}
        />
        <ModuleCard
          href="/project/delivery-notes"
          icon={Package}
          title="תעודות משלוח"
          lines={[
            `${counts.dnDraft} טיוטות`,
            `${counts.dnPending} ממתינות לאישור`,
            `${counts.dnDelivered} נמסרו`,
          ]}
        />
        <BigCard
          href="/project/documents"
          icon={FileText}
          title="מסמכי הפרויקט"
          subtitle="צפייה · PDF · ארכיון"
          badge={counts.documents > 0 ? counts.documents : undefined}
        />
        <BigCard
          href="/project/approvals"
          icon={CheckSquare}
          title="בקשות לאישור"
          subtitle="מהגיע מהשטח / משרד"
          badge={loading ? undefined : counts.approvals}
          hot={counts.approvals > 0}
        />
        <BigCard
          href="/project/signatures"
          icon={PenLine}
          title="חתימות"
          subtitle="מי פתח · מי חתם · תזכורת"
          badge={
            counts.signaturesOpen > 0 ? counts.signaturesOpen : undefined
          }
        />
        <BigCard
          href="/project/share-links"
          icon={Link2}
          title="Share Links"
          subtitle="שליחה ללקוח / מפקח בלי משתמש"
          badge={counts.shareLinks > 0 ? counts.shareLinks : undefined}
        />
        <BigCard
          href="/project/notifications"
          icon={Bell}
          title="התראות"
          subtitle="חדש · אושר · הוחזר · נחתם"
          badge={
            counts.notifications > 0 ? counts.notifications : undefined
          }
        />
      </div>
    </div>
  );
}

function ModuleCard({
  href,
  icon: Icon,
  title,
  lines,
  primary,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  lines: string[];
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[5.5rem] items-center gap-4 rounded-3xl px-5 transition active:scale-[0.99]",
        primary
          ? "bg-blue-700 text-white shadow-sm"
          : "border border-blue-200 bg-white text-slate-900"
      )}
    >
      <Icon className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-black leading-tight">{title}</p>
        <p
          className={cn(
            "mt-1 text-sm leading-relaxed",
            primary ? "text-blue-100" : "text-slate-500"
          )}
        >
          {lines.join(" · ")}
        </p>
      </div>
    </Link>
  );
}

function BigCard({
  href,
  icon: Icon,
  title,
  subtitle,
  badge,
  hot,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  badge?: number;
  hot?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[5.25rem] items-center gap-4 rounded-3xl px-5 transition active:scale-[0.99]",
        hot
          ? "bg-blue-700 text-white shadow-sm"
          : "border border-blue-200 bg-white text-slate-900"
      )}
    >
      <Icon className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-black leading-tight">{title}</p>
        <p
          className={cn("mt-1 text-sm", hot ? "text-blue-100" : "text-slate-500")}
        >
          {subtitle}
        </p>
      </div>
      {typeof badge === "number" && (
        <span
          className={cn(
            "flex h-11 min-w-11 items-center justify-center rounded-full px-2 text-base font-black",
            hot ? "bg-white text-blue-800" : "bg-blue-700 text-white"
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
