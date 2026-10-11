"use client";

import { usePathname } from "next/navigation";
import { SubcontractorAppShell } from "@/apps/subcontractor/subcontractor-app-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (
    pathname.startsWith("/subcontractor/activate") ||
    pathname === "/subcontractor/login"
  ) {
    return <>{children}</>;
  }
  return <SubcontractorAppShell>{children}</SubcontractorAppShell>;
}
