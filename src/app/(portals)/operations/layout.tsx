import { PortalShell } from "@/components/portal";

export default function OperationsPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell portalId="operations">{children}</PortalShell>;
}
