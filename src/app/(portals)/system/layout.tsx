import { PortalShell } from "@/components/portal";

export default function SystemPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell portalId="system">{children}</PortalShell>;
}
