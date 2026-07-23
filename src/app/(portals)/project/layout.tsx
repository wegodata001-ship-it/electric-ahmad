import { PortalShell } from "@/components/portal";

export default function ProjectPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell portalId="project">{children}</PortalShell>;
}
