"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app.store";
import { searchService } from "@/services";
import { notificationService } from "@/features/notifications/services/notification.service";
import { Avatar, Button } from "@/components/ui";
import { formatRelative } from "@/utils/format";
import { motion, AnimatePresence } from "framer-motion";

type OfficeMe = {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  avatarUrl: string;
};

const breadcrumbMap: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "פרויקטים",
  boq: "כתבי כמויות",
  employees: "עובדים",
  reports: "דיווחים",
  documents: "מסמכים",
  invoices: "חשבונות",
  "partial-invoices": "חשבונות",
  "delivery-notes": "תעודות משלוח",
  foremen: "מנהלי עבודה",
  gallery: "דיווחים",
  settings: "הגדרות",
  worker: "אפליקציית עובד",
  field: "אפליקציית שטח",
  new: "חדש",
  print: "הדפסה",
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sidebarCollapsed,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searchOpen,
    setSearchOpen,
    notifications,
    setNotifications,
    notificationsOpen,
    setNotificationsOpen,
    markNotificationRead,
    markAllNotificationsRead,
    unreadCount,
    setMobileNavOpen,
  } = useAppStore();

  const [searchFocused, setSearchFocused] = useState(false);
  const [me, setMe] = useState<OfficeMe | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    notificationService
      .getAll()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, [setNotifications]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setMe(json.data);
      })
      .catch(() => undefined);
  }, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.length >= 2) {
        const results = await searchService.search(query);
        setSearchResults(results);
        setSearchOpen(true);
      } else {
        setSearchResults([]);
        setSearchOpen(false);
      }
    },
    [setSearchQuery, setSearchResults, setSearchOpen]
  );

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg) => breadcrumbMap[seg] || seg);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 min-h-14 bg-white/95 backdrop-blur-md border-b border-gray-200/80 z-30 flex flex-wrap items-center px-3 py-2 gap-2 transition-all duration-300 lg:h-16 lg:flex-nowrap lg:px-6 lg:py-0 lg:gap-4",
        sidebarCollapsed ? "lg:right-[72px]" : "lg:right-[260px]"
      )}
    >
      <button
        type="button"
        aria-label="פתח תפריט ניווט"
        onClick={() => setMobileNavOpen(true)}
        className="lg:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
      >
        <Menu className="h-5 w-5" />
      </button>

      <nav className="hidden lg:flex items-center gap-1.5 text-sm text-gray-500 min-w-0">
        <Link href="/dashboard" className="hover:text-gray-700 transition-colors">בית</Link>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-gray-300">/</span>
            <span className={cn(i === breadcrumbs.length - 1 ? "text-gray-900 font-medium" : "hover:text-gray-700")}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      <div className="order-3 basis-full flex-none relative lg:order-none lg:flex-1 lg:basis-auto lg:max-w-md lg:mx-auto">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש פרויקטים, עובדים, כתבי כמויות, חשבונות..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            className="w-full h-11 lg:h-9 pr-10 pl-4 text-sm bg-gray-50 border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
          />
        </div>

        <AnimatePresence>
          {searchOpen && searchResults.length > 0 && searchFocused && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50"
            >
              {searchResults.map((result) => (
                <Link
                  key={result.id}
                  href={result.link}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => setSearchOpen(false)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{result.title}</p>
                    <p className="text-xs text-gray-500">{result.subtitle}</p>
                  </div>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-1.5 lg:gap-2 mr-auto lg:mr-0">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
          >
            <Bell className="h-5 w-5" />
            {unreadCount() > 0 && (
              <span className="absolute -top-0.5 -left-0.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount()}
              </span>
            )}
          </Button>

          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-50"
              >
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">התראות</h3>
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    סמן הכל כנקרא
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => markNotificationRead(notif.id)}
                      className={cn(
                        "w-full text-right px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50",
                        !notif.read && "bg-primary-50/50"
                      )}
                    >
                      <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatRelative(notif.createdAt)}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 mr-2 pr-2 border-r border-gray-200">
          <Avatar
            src={me?.avatarUrl}
            name={me?.name || "משתמש"}
            size="sm"
          />
          <div className="hidden lg:block min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-tight truncate">
              {me?.name || "…"}
            </p>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="text-xs text-gray-400 leading-tight hover:text-red-600 transition-colors inline-flex items-center gap-1"
            >
              <LogOut className="h-3 w-3" />
              {loggingOut ? "מתנתק..." : "התנתק"}
            </button>
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            title="התנתק"
            className="lg:hidden p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
