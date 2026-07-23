"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { notificationService } from "@/features/notifications/services/notification.service";
import type { Notification } from "@/types";
import { formatRelative } from "@/utils/format";

type Props = {
  notificationsHref?: string;
};

export function PortalNotificationIcon({ notificationsHref }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  const reload = useCallback(() => {
    notificationService
      .getAll()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function markRead(id: string) {
    await notificationService.markAsRead(id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  async function markAllRead() {
    await notificationService.markAllAsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
        aria-label="התראות"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">התראות</h3>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs font-medium text-[var(--portal-accent,#1d4ed8)] hover:underline"
            >
              סמן הכל כנקרא
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">
                טוען...
              </p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-400">
                אין התראות
              </p>
            )}
            {items.slice(0, 12).map((notif) => (
              <button
                key={notif.id}
                type="button"
                onClick={() => void markRead(notif.id)}
                className={`w-full border-b border-gray-50 px-4 py-3 text-right transition-colors hover:bg-gray-50 ${
                  !notif.read ? "bg-blue-50/40" : ""
                }`}
              >
                <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{notif.message}</p>
                <p className="mt-1 text-[11px] text-gray-400">
                  {formatRelative(notif.createdAt)}
                </p>
              </button>
            ))}
          </div>

          {notificationsHref && (
            <div className="border-t border-gray-100 p-2">
              <Link
                href={notificationsHref}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-center text-xs font-semibold text-[var(--portal-accent,#1d4ed8)] hover:bg-gray-50"
              >
                מרכז התראות
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
