"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { BookOpen, Home, LogOut, Package, UserRound, Users } from "lucide-react";
import { BrandLogo, BrandWordmark } from "@/components/brand/brand-logo";

const nav = [
  { name: "בית", href: "/field", icon: Home },
  { name: "יומן עבודה", href: "/field/work-diaries", icon: BookOpen },
  { name: "תעודות", href: "/field/delivery-notes", icon: Package },
  { name: "עובדים שלי", href: "/field/crew", icon: Users },
  { name: "פרופיל", href: "/field/profile", icon: UserRound },
] as const;

/**
 * @deprecated Unused. Field portal uses `FieldAppShell` (`max-w-lg` portal).
 * Do not wire this wide desktop sidebar layout back into Field routes.
 */
export function FieldLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/field/login";

  async function logout() {
    await fetch("/api/field/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-gray-900">
      {/* Mobile header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 lg:hidden">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo height={28} maxWidth={96} />
            <div>
              <BrandWordmark compact />
              <p className="text-[11px] text-gray-500">מנהל עבודה</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 text-xs text-gray-500"
          >
            <LogOut className="h-4 w-4" />
            יציאה
          </button>
        </div>
      </header>

      <div className="lg:flex lg:min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-56 lg:flex-col lg:border-l lg:border-gray-200 lg:bg-white lg:sticky lg:top-0 lg:h-screen">
          <div className="px-4 h-16 flex items-center gap-2 border-b border-gray-100">
            <BrandLogo height={28} maxWidth={96} />
            <div>
              <BrandWordmark compact />
              <p className="text-[11px] text-gray-500">מנהל עבודה</p>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {nav.map((item) => {
              const active =
                item.href === "/field"
                  ? pathname === "/field"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium",
                    active
                      ? "bg-[#eff6ff] text-[#1e40af]"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={logout}
            className="m-3 flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-gray-500 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            יציאה מהמערכת
          </button>
        </aside>

        <main className="flex-1 w-full px-4 py-4 pb-28 lg:px-8 lg:py-6 lg:pb-8 lg:max-w-6xl">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 lg:hidden">
        <div className="flex">
          {nav.map((item) => {
            const active =
              item.href === "/field"
                ? pathname === "/field"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold",
                  active ? "text-[#1e40af]" : "text-gray-400"
                )}
              >
                <item.icon className="h-6 w-6" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
