import { SystemAppShell } from "@/apps/system/system-app-shell";

export default function SystemPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SystemAppShell>{children}</SystemAppShell>;
}
