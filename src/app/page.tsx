import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  OFFICE_SESSION_COOKIE,
  verifyOfficeSession,
} from "@/lib/auth/office-cookie";
import {
  FIELD_SESSION_COOKIE,
  verifyFieldSession,
} from "@/lib/auth/field-cookie";
import { portalHomeForRole } from "@/lib/portals/config";

/** Root → portal home by session, else login */
export default async function Home() {
  const jar = await cookies();
  const field = await verifyFieldSession(
    jar.get(FIELD_SESSION_COOKIE)?.value
  );
  if (field) redirect("/field");

  const office = await verifyOfficeSession(
    jar.get(OFFICE_SESSION_COOKIE)?.value
  );
  if (office) {
    const home = portalHomeForRole(office.role);
    redirect(home === "/login" ? "/project" : home);
  }

  redirect("/login");
}
