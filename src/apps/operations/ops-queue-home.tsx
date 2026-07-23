"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckSquare,
  ClipboardList,
  FileBarChart2,
  Package,
  Plus,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Queue = {
  workOrdersToday: number;
  diariesPending: number;
  deliveryPending: number;
  diariesRevision: number;
  workOrdersDone: number;
};

export function OpsQueueHome() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get<{ queue: Queue }>("/api/work-orders")
      .then((d) => setQueue(d.queue))
      .catch((e) => setError(e.message));
  }, []);

  const pendingApprovals =
    (queue?.diariesPending ?? 0) + (queue?.deliveryPending ?? 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-stone-900">מה עושים עכשיו?</h2>
        <p className="mt-1 text-sm text-stone-500">
          לחץ על כפתור — בלי Dashboard ובלי כרטיסי KPI
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-3">
        <BigButton
          href="/operations/work-orders/new"
          icon={Plus}
          title="יצירת סידור עבודה"
          subtitle="פרויקט · מנהל עבודה · עובדים · שלח"
          primary
        />
        <BigButton
          href="/operations/approvals"
          icon={CheckSquare}
          title="מרכז אישורים"
          subtitle="אשר או החזר לתיקון"
          badge={pendingApprovals}
          hot={pendingApprovals > 0}
        />
        <BigButton
          href="/operations/work-diaries"
          icon={BookOpen}
          title="יומני עבודה"
          subtitle="דיווחים מהשטח"
          badge={queue?.diariesPending}
        />
        <BigButton
          href="/operations/delivery-notes"
          icon={Package}
          title="תעודות משלוח"
          subtitle="ציוד וכמויות"
          badge={queue?.deliveryPending}
        />
        <BigButton
          href="/operations/reports"
          icon={FileBarChart2}
          title="דוחות ביצוע"
          subtitle="פתיחת דוחות מהשטח"
        />
        <BigButton
          href="/operations/work-orders"
          icon={ClipboardList}
          title="סידורי עבודה"
          subtitle={`היום: ${queue?.workOrdersToday ?? "—"} · הסתיימו: ${queue?.workOrdersDone ?? "—"}`}
        />
        <BigButton
          href="/operations/workers"
          icon={Users}
          title="עובדים"
          subtitle="מנהלי עבודה וצוותים"
        />
      </div>

      {(queue?.diariesRevision ?? 0) > 0 && (
        <Link
          href="/operations/approvals"
          className="flex min-h-14 items-center justify-between rounded-2xl bg-orange-100 px-4 font-black text-orange-950 ring-1 ring-orange-200"
        >
          <span>הוחזרו לתיקון — לטיפול</span>
          <span className="rounded-full bg-orange-500 px-3 py-1 text-sm text-white">
            {queue?.diariesRevision}
          </span>
        </Link>
      )}
    </div>
  );
}

function BigButton({
  href,
  icon: Icon,
  title,
  subtitle,
  primary,
  badge,
  hot,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  primary?: boolean;
  badge?: number;
  hot?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[4.5rem] items-center gap-4 rounded-2xl px-5 transition active:scale-[0.99]",
        primary
          ? "bg-amber-700 text-white shadow-sm"
          : hot
            ? "bg-amber-600 text-white"
            : "bg-white text-stone-900 ring-2 ring-amber-200"
      )}
    >
      <Icon className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-black">{title}</p>
        <p
          className={cn(
            "text-sm",
            primary || hot ? "text-amber-100" : "text-stone-500"
          )}
        >
          {subtitle}
        </p>
      </div>
      {typeof badge === "number" && badge > 0 && (
        <span
          className={cn(
            "flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-base font-black",
            primary || hot
              ? "bg-white text-amber-800"
              : "bg-amber-700 text-white"
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
