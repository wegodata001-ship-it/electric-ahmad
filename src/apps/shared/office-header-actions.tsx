"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import type { Notification } from "@/types";
import { notificationService } from "@/features/notifications/services/notification.service";
import { formatRelative } from "@/utils/format";
import { roleGradeLabel } from "@/lib/auth/document-permissions";
import { cn } from "@/lib/utils";

type Props = {
  userName: string | null;
  role: string | null;
  notificationsHref: string;
  loggingOut: boolean;
  onLogout: () => void | Promise<void>;
};

export function OfficeHeaderActions({
  userName,
  role,
  notificationsHref,
  loggingOut,
  onLogout,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      setItems(await notificationService.getAll());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const unread = items.filter((item) => !item.read).length;
  const latest = items.slice(0, 6);

  async function openNotification(notification: Notification) {
    if (!notification.read) {
      await notificationService.markAsRead(notification.id);
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item
        )
      );
    }
    setOpen(false);
    if (notification.link) router.push(notification.link);
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-900">
          {userName || "משתמש"}
        </p>
        <p className="truncate text-xs text-slate-500">
          {roleGradeLabel(role)}
        </p>
      </div>

      <div className="flex items-center gap-2" ref={rootRef}>
        <div className="relative">
          <button
            type="button"
            aria-label="התראות"
            aria-expanded={open}
            onClick={() => {
              setOpen((current) => !current);
              if (!open) void reload();
            }}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -left-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-black leading-5 text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute left-0 top-12 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-black text-slate-900">התראות</p>
                {unread > 0 && (
                  <span className="text-xs font-bold text-red-600">
                    {unread} לא נקראו
                  </span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {loading && (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    טוען…
                  </p>
                )}
                {!loading && latest.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    אין התראות
                  </p>
                )}
                {!loading &&
                  latest.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => void openNotification(notification)}
                      className={cn(
                        "block w-full border-b border-slate-100 px-4 py-3 text-right last:border-0 hover:bg-slate-50",
                        !notification.read && "bg-blue-50/60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {notification.type} ·{" "}
                        {formatRelative(notification.createdAt)}
                      </p>
                    </button>
                  ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(notificationsHref);
                }}
                className="w-full border-t border-slate-100 px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-50"
              >
                צפה בכל ההתראות
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void onLogout()}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">
            {loggingOut ? "יוצא…" : "יציאה"}
          </span>
        </button>
      </div>
    </header>
  );
}
