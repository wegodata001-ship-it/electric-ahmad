import { PortalShell } from "@/components/portal";

/** System Manager — full ERP control center (original light shell + nav) */
export default function SystemPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell portalId="system">{children}</PortalShell>;
}
