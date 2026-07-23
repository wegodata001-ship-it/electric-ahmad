"use client";

import { usePathname } from "next/navigation";
import { PortalShell } from "@/components/portal";

export default function FieldPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/field/login") {
    return <>{children}</>;
  }
  return <PortalShell portalId="field">{children}</PortalShell>;
}
