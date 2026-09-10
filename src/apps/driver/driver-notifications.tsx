"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { notificationService } from "@/features/notifications/services/notification.service";
import type { Notification } from "@/types";
import { formatRelative } from "@/utils/format";
import { cn } from "@/lib/utils";
import { resolveDriverNotificationLink } from "@/apps/shared/portal-notifications-menu";

export function DriverNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    notificationService
      .getAll()
      .then(setItems)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function markRead(id: string) {
    await notificationService.markAsRead(id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <h1 className="flex items-center gap-2 text-xl font-black text-[#0F172A]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
            <Bell className="h-5 w-5" />
          </span>
          התראות
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          תעודות משלוח · אישורים · החזרות
        </p>
      </section>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && (
        <p className="text-center text-sm text-[#64748B]">טוען…</p>
      )}

      {!loading && items.length === 0 && (
        <p className="rounded-3xl border border-dashed border-[#DCE4EF] bg-white py-12 text-center text-[#64748B]">
          אין התראות
        </p>
      )}

      <ul className="space-y-2">
        {items.map((n) => {
          const href = resolveDriverNotificationLink(n.link);
          return (
            <li key={n.id}>
              <Link
                href={href || "/driver/delivery-notes"}
                onClick={() => {
                  if (!n.read) void markRead(n.id);
                }}
                className={cn(
                  "block rounded-2xl border px-4 py-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)]",
                  n.read
                    ? "border-[#DCE4EF] bg-white"
                    : "border-[#BFDBFE] bg-[#EFF6FF]"
                )}
              >
                <p className="font-bold text-[#0F172A]">{n.title}</p>
                {n.message && (
                  <p className="mt-1 text-sm text-[#64748B]">{n.message}</p>
                )}
                <p className="mt-2 text-xs text-[#94A3B8]">
                  {formatRelative(n.createdAt)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
