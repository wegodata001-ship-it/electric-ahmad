"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BrandLogo, BrandWordmark } from "@/components/brand/brand-logo";
import { COMPANY_PROFILE } from "@/config/company";
import { cn } from "@/lib/utils";

export type OfficeNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: boolean;
};

type Props = {
  homeHref: string;
  items: OfficeNavItem[];
  pathname: string;
  pendingCount?: number;
  mobileOpen: boolean;
  onClose: () => void;
  portalLabel?: string;
};

function isActive(pathname: string, item: OfficeNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavList({
  items,
  pathname,
  pendingCount = 0,
  onNavigate,
}: {
  items: OfficeNavItem[];
  pathname: string;
  pendingCount?: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
      {items.map((item) => {
        const active = isActive(pathname, item);
        const showBadge = Boolean(item.badge && pendingCount > 0);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              !active && "text-[var(--brand-text-muted)] hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-text)]"
            )}
            style={
              active
                ? {
                    background: "var(--brand-primary-soft)",
                    color: "var(--brand-primary)",
                  }
                : undefined
            }
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </span>
            {showBadge && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-black text-white"
                style={{ background: "var(--brand-primary)" }}
              >
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandBlock({
  homeHref,
  portalLabel,
}: {
  homeHref: string;
  portalLabel?: string;
}) {
  return (
    <Link href={homeHref} className="block border-b border-[var(--brand-border)] px-4 py-4">
      <BrandLogo height={44} maxWidth={168} />
      <div className="mt-3">
        <BrandWordmark />
        {portalLabel && (
          <p className="mt-1 truncate text-[10px] font-bold tracking-wide text-[var(--brand-primary)]">
            {portalLabel}
          </p>
        )}
      </div>
    </Link>
  );
}

export function OfficeBrandSidebar({
  homeHref,
  items,
  pathname,
  pendingCount = 0,
  mobileOpen,
  onClose,
  portalLabel,
}: Props) {
  const content = (
    <>
      <BrandBlock homeHref={homeHref} portalLabel={portalLabel} />
      <NavList
        items={items}
        pathname={pathname}
        pendingCount={pendingCount}
        onNavigate={onClose}
      />
      <div className="border-t border-[var(--brand-border)] px-4 py-3 text-[11px] text-[var(--brand-text-muted)]">
        {COMPANY_PROFILE.name}
      </div>
    </>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-l border-[var(--brand-border)] bg-[var(--brand-surface)] lg:flex">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="סגור תפריט"
            onClick={onClose}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(86vw,18rem)] flex-col bg-[var(--brand-surface)] shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

export { isActive as isOfficeNavActive };
