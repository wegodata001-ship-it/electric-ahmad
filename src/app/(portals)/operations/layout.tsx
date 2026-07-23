import { OpsAppShell } from "@/apps/operations/ops-app-shell";

export default function OperationsPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OpsAppShell>{children}</OpsAppShell>;
}
