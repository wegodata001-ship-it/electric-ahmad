"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/operations", label: "בית", exact: true },
  { href: "/operations/work-orders/new", label: "סידור חדש" },
  { href: "/operations/approvals", label: "אישורים" },
  { href: "/operations/reports", label: "דוחות" },
  { href: "/operations/work-diaries", label: "יומנים" },
  { href: "/operations/delivery-notes", label: "תעודות" },
  { href: "/operations/workers", label: "עובדים" },
];

export function OpsAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, ready, loggingOut, logout } = usePortalSession("operations");

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fff7ed] text-amber-900">
        טוען…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#fff7ed] text-stone-900"
      dir="rtl"
      data-app="operations"
    >
      <header className="border-b border-amber-200/80 bg-[#fffbeb]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
              Operations
            </p>
            <h1 className="text-lg font-black text-stone-900">מרכז עבודה</h1>
            <p className="text-xs text-stone-500">{userName}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold"
          >
            יציאה
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-3">
          {NAV.map((item) => {
            const exact = "exact" in item && item.exact;
            const active = exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-2 text-sm font-bold",
                  active
                    ? "bg-amber-700 text-white"
                    : "bg-white text-stone-600 ring-1 ring-amber-200"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
    </div>
  );
}
