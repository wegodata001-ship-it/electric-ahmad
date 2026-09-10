"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import type { Notification } from "@/types";
import { notificationService } from "@/features/notifications/services/notification.service";
import { formatRelative } from "@/utils/format";
import { cn } from "@/lib/utils";

type Props = {
  notificationsHref: string;
  /** Optional rewrite so portal users never land on another role's routes. */
  resolveLink?: (link?: string | null) => string | undefined;
  className?: string;
};

export function PortalNotificationsMenu({
  notificationsHref,
  resolveLink,
  className,
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
    const href =
      resolveLink?.(notification.link) ??
      notification.link ??
      notificationsHref;
    if (href) router.push(href);
  }

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <button
        type="button"
        aria-label="התראות"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          if (!open) void reload();
        }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE4EF] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -left-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-black leading-5 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#DCE4EF] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#E8EEF6] px-4 py-3">
            <p className="text-sm font-black text-[#0F172A]">התראות</p>
            {unread > 0 && (
              <span className="text-xs font-bold text-red-600">
                {unread} לא נקראו
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="px-4 py-8 text-center text-sm text-[#64748B]">
                טוען…
              </p>
            )}
            {!loading && latest.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-[#64748B]">
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
                    "block w-full border-b border-[#E8EEF6] px-4 py-3 text-right last:border-0 hover:bg-[#F8FAFC]",
                    !notification.read && "bg-[#EFF6FF]/60"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-[#0F172A]">
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[#64748B]">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">
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
            className="w-full border-t border-[#E8EEF6] px-4 py-3 text-sm font-black text-[#2563EB] hover:bg-[#EFF6FF]"
          >
            הצג את כל ההתראות
          </button>
        </div>
      )}
    </div>
  );
}

/** Keep truck drivers inside their portal when opening notification links. */
export function resolveDriverNotificationLink(
  link?: string | null
): string | undefined {
  if (!link) return "/driver/delivery-notes";
  if (link.startsWith("/driver/")) return link;
  const match = link.match(/\/(?:ops-)?delivery-notes\/([^/?#]+)/);
  if (match?.[1]) return `/driver/delivery-notes/${match[1]}`;
  if (
    link.startsWith("/field/") ||
    link.startsWith("/operations/") ||
    link.startsWith("/project/") ||
    link.startsWith("/system/") ||
    link.startsWith("/approvals")
  ) {
    return "/driver/delivery-notes";
  }
  return link;
}
