"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { notificationService } from "@/features/notifications/services/notification.service";
import type { Notification } from "@/types";
import { formatRelative } from "@/utils/format";
import { ActionBarContainer } from "@/components/portal";

export function NotificationCenterPage() {
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

  const unread = items.filter((n) => !n.read).length;

  async function markAllRead() {
    await notificationService.markAllAsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function markRead(id: string) {
    await notificationService.markAsRead(id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">מרכז התראות</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unread > 0 ? `${unread} התראות שלא נקראו` : "הכל נקרא"}
          </p>
        </div>
      </div>

      <ActionBarContainer
        actions={[
          {
            id: "refresh",
            label: "רענון",
            icon: RefreshCw,
            onClick: reload,
          },
          {
            id: "mark-all",
            label: "סמן הכל כנקרא",
            icon: CheckCheck,
            onClick: () => void markAllRead(),
            hidden: unread === 0,
          },
        ]}
      />

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {loading && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">טוען...</p>
        )}
        {!loading && items.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            אין התראות
          </p>
        )}
        {!loading && items.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {items.map((notif) => (
              <li key={notif.id}>
                <button
                  type="button"
                  onClick={() => void markRead(notif.id)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-right transition-colors hover:bg-gray-50 ${
                    !notif.read ? "bg-blue-50/40" : ""
                  }`}
                >
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {notif.title}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {notif.message}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      {formatRelative(notif.createdAt)}
                    </p>
                    {notif.link && (
                      <Link
                        href={notif.link}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 inline-block text-xs font-semibold text-[var(--portal-accent,#1d4ed8)] hover:underline"
                      >
                        פתח
                      </Link>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
