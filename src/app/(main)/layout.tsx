import { OfficePortalBridge } from "@/components/portal/office-portal-bridge";

/** Legacy office routes → Portal shell by role (Sprint 1 demo) */
export default function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OfficePortalBridge>{children}</OfficePortalBridge>;
}
