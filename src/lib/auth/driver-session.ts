import {
  requireOfficeUser,
  OfficeAuthError,
  type OfficeUserSession,
} from "@/lib/auth/office-session";
import { isTruckDriverRole } from "@/lib/auth/driver-permissions";

export async function requireTruckDriver(): Promise<OfficeUserSession> {
  const session = await requireOfficeUser();
  if (!isTruckDriverRole(session.role)) {
    throw new OfficeAuthError("גישה לנהגים בלבד", 403);
  }
  return session;
}
