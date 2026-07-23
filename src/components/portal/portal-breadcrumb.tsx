"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PortalDefinition } from "@/lib/portals/config";

export function PortalBreadcrumb({ portal }: { portal: PortalDefinition }) {
  const pathname = usePathname();
  const rest = pathname
    .replace(portal.home, "")
    .split("/")
    .filter(Boolean);

  const currentNav = portal.nav.find(
    (n) =>
      n.href === pathname ||
      (n.href !== portal.home && pathname.startsWith(n.href))
  );

  return (
    <nav
      aria-label="breadcrumb"
      className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500"
    >
      <Link
        href={portal.home}
        className="hover:text-gray-800"
        style={{ color: undefined }}
      >
        {portal.headerTitle}
      </Link>
      {currentNav && currentNav.href !== portal.home && (
        <>
          <span aria-hidden>/</span>
          <span className="font-medium text-gray-700">{currentNav.label}</span>
        </>
      )}
      {!currentNav && rest.length > 0 && (
        <>
          <span aria-hidden>/</span>
          <span className="font-medium text-gray-700">
            {rest[rest.length - 1]}
          </span>
        </>
      )}
    </nav>
  );
}
