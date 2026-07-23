import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  OFFICE_SESSION_COOKIE,
  verifyOfficeSession,
} from "@/lib/auth/office-cookie";
import { portalHomeForRole } from "@/lib/portals/config";
import { DashboardPage } from "@/features/dashboard/components/dashboard-page";

/**
 * Legacy /dashboard — redirect office users to their Portal.
 * Keep DashboardPage as fallback if role unknown.
 */
export default async function Page() {
  const jar = await cookies();
  const office = await verifyOfficeSession(
    jar.get(OFFICE_SESSION_COOKIE)?.value
  );
  if (office) {
    const home = portalHomeForRole(office.role);
    if (home !== "/login") redirect(home);
  }
  return <DashboardPage />;
}
