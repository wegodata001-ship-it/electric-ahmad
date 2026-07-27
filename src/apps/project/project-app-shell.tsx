"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  ClipboardList,
  FileText,
  FolderOpen,
  Home,
  Wallet,
} from "lucide-react";
import { usePortalSession } from "@/apps/shared/use-portal-session";
import { cn } from "@/lib/utils";

/**
 * Project Manager = Portal (not Admin).
 * Narrow column + bottom tabs — same family as Ops/Field.
 * Never use SystemAppShell / PortalShell / max-w-6xl desktop workspace here.
 */
const TABS = [
  { href: "/project", label: "בית", icon: Home, exact: true },
  { href: "/project/projects", label: "פרויקטים", icon: ClipboardList },
  { href: "/project/accounts", label: "חשבונות", icon: Wallet },
  { href: "/project/documents", label: "מסמכים", icon: FolderOpen },
  { href: "/project/approvals", label: "אישורים", icon: CheckSquare },
] as const;

const HEADER_LINKS = [
  { href: "/project/boq", label: "כתב כמויות", icon: FileText },
  { href: "/project/delivery-notes", label: "תעודות", icon: ClipboardList },
] as const;

export function ProjectAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userName, ready, loggingOut, logout } = usePortalSession("project");

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f0f5ff] text-blue-900">
        טוען…
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-[#f0f5ff] text-slate-900"
      dir="rtl"
      data-app="project"
      data-layout="portal"
    >
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-blue-200/70 bg-white/95 px-3 backdrop-blur">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-blue-700">Project Portal</p>
          <p className="truncate text-sm font-black">
            {userName || "מנהל פרויקט"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {HEADER_LINKS.map((link) => {
            const Icon = link.icon;
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                className={cn(
                  "rounded-xl border px-2.5 py-2 text-xs font-bold",
                  active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-blue-200 text-blue-800"
                )}
              >
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
          >
            יציאה
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-3 pb-28 pt-4">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-200/80 bg-white/98 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-0.5">
          {TABS.map((tab) => {
            const exact = "exact" in tab && tab.exact;
            const active = exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex min-h-[4.25rem] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold leading-tight",
                  active ? "text-blue-700" : "text-slate-400"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
