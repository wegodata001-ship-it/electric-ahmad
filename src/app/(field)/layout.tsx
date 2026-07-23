"use client";

import { usePathname } from "next/navigation";
import { FieldAppShell } from "@/apps/field/field-app-shell";

export default function FieldPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/field/login") {
    return <>{children}</>;
  }
  return <FieldAppShell>{children}</FieldAppShell>;
}
