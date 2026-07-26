"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { notificationService } from "@/features/notifications/services/notification.service";
import type { Notification } from "@/types";
import { formatRelative } from "@/utils/format";
import { cn } from "@/lib/utils";

export function OpsNotifications() {
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
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Bell className="h-7 w-7 text-amber-700" />
          התראות
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          יומנים · תעודות · אישורים · החזרות
        </p>
      </section>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && <p className="text-center text-stone-400">טוען…</p>}

      {!loading && items.length === 0 && (
        <p className="rounded-3xl border border-dashed border-amber-300 bg-white py-12 text-center text-stone-400">
          אין התראות
        </p>
      )}

      <ul className="space-y-2">
        {items.map((n) => {
          const href = n.link || "/operations/approvals";
          return (
            <li key={n.id}>
              <Link
                href={href}
                onClick={() => {
                  if (!n.read) void markRead(n.id);
                }}
                className={cn(
                  "block rounded-2xl border-2 px-4 py-4",
                  n.read
                    ? "border-stone-200 bg-white"
                    : "border-amber-300 bg-amber-50"
                )}
              >
                <p className="font-bold text-stone-900">{n.title}</p>
                {n.message && (
                  <p className="mt-1 text-sm text-stone-600">{n.message}</p>
                )}
                <p className="mt-2 text-xs text-stone-400">
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
