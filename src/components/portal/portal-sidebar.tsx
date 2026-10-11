"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { PortalDefinition, PortalNavItem } from "@/lib/portals/config";
import { BrandLogo, BrandWordmark } from "@/components/brand/brand-logo";

type Props = {
  portal: PortalDefinition;
  mobileOpen: boolean;
  onNavigate?: () => void;
};

function NavLink({
  item,
  active,
  accent,
  accentSoft,
  onNavigate,
}: {
  item: PortalNavItem;
  active: boolean;
  accent: string;
  accentSoft: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        !active && "text-gray-600 hover:bg-white/80 hover:text-gray-900"
      )}
      style={
        active
          ? { background: accentSoft, color: accent }
          : undefined
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function PortalSidebar({ portal, mobileOpen, onNavigate }: Props) {
  const pathname = usePathname();
  const { theme } = portal;

  const content = (
    <>
      <div
        className="flex h-16 items-center gap-2.5 border-b border-gray-200/80 px-4"
        style={{ background: theme.headerTint }}
      >
        <BrandLogo height={32} maxWidth={72} />
        <div className="min-w-0">
          <BrandWordmark compact />
          <p className="truncate text-[11px] text-gray-500">
            {portal.headerTitle}
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {portal.nav.map((item) => {
          const active =
            item.href === portal.home
              ? pathname === portal.home
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <NavLink
              key={item.href}
              item={item}
              active={active}
              accent={theme.accent}
              accentSoft={theme.accentSoft}
              onNavigate={onNavigate}
            />
          );
        })}
      </nav>
      <div className="border-t border-gray-200/80 px-4 py-3 text-[11px] text-gray-400">
        {portal.headerTitle}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop — sticky sidebar */}
      <aside
        className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-l border-gray-200 lg:flex"
        style={{ background: theme.sidebarBg }}
      >
        {content}
      </aside>

      {/* Mobile / tablet drawer — widths 360–430 friendly */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="סגור תפריט"
            onClick={onNavigate}
          />
          <aside
            className="absolute inset-y-0 right-0 flex w-[min(86vw,18rem)] flex-col shadow-xl"
            style={{ background: theme.sidebarBg }}
          >
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
