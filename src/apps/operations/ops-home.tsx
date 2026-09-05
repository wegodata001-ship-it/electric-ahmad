"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckSquare, ClipboardList } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { notificationService } from "@/features/notifications/services/notification.service";
import { cn } from "@/lib/utils";

type Queue = {
  diariesPending: number;
  deliveryPending: number;
  workOrdersToday: number;
};

export function OpsHome() {
  const [approvals, setApprovals] = useState(0);
  const [workOrders, setWorkOrders] = useState(0);
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    Promise.allSettled([
      apiClient.get<{ queue: Queue }>("/api/work-orders"),
      apiClient.get<{ items: unknown[] }>("/api/approvals/pending"),
      notificationService.getUnread(),
    ]).then(([q, a, n]) => {
      if (q.status === "fulfilled") {
        setWorkOrders(q.value.queue.workOrdersToday ?? 0);
        setApprovals(
          (q.value.queue.diariesPending ?? 0) +
            (q.value.queue.deliveryPending ?? 0)
        );
      }
      if (a.status === "fulfilled") {
        setApprovals((prev) => Math.max(prev, a.value.items.length));
      }
      if (n.status === "fulfilled") setNotifications(n.value.length);
    });
  }, []);

  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-2xl font-black tracking-tight">מה עושים היום?</h1>
        <p className="mt-1 text-sm text-stone-500">
          סידורים · אישורים — נוכחות רק דרך סריקת QR
        </p>
      </section>

      <nav className="grid gap-3">
        <HomeCard
          href="/operations/work-orders"
          icon={ClipboardList}
          title="סידורי עבודה"
          subtitle="יצירה · שליחה למנהל עבודה"
          badge={workOrders > 0 ? workOrders : undefined}
        />
        <HomeCard
          href="/operations/approvals"
          icon={CheckSquare}
          title={`🔔 ממתין לאישור (${approvals})`}
          subtitle="יומני עבודה · תעודות משלוח"
          badge={approvals > 0 ? approvals : undefined}
          hot={approvals > 0}
        />
        <HomeCard
          href="/operations/notifications"
          icon={Bell}
          title="התראות"
          subtitle="מה התקבל מהשטח"
          badge={notifications > 0 ? notifications : undefined}
        />
      </nav>
    </div>
  );
}

function HomeCard({
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
        "flex min-h-[5.5rem] items-center gap-4 rounded-3xl border-2 bg-white px-4 py-4 shadow-sm transition active:scale-[0.99]",
        hot ? "border-amber-500 ring-2 ring-amber-200" : "border-amber-200"
      )}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
        <Icon className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-black">{title}</span>
        <span className="block text-sm text-stone-500">{subtitle}</span>
      </span>
      {badge != null && (
        <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-amber-700 px-2 text-sm font-black text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
