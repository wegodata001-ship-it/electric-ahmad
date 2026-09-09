import {
  OfficeAuthError,
  requireOfficeUser,
} from "@/lib/auth/office-session";
import { requireFieldManager } from "@/lib/auth/field-session";

export type TimelineSession = {
  userId: string;
  userName: string;
  role: string;
  employeeId: string | null;
};

export async function requireTimelineSession(): Promise<TimelineSession> {
  try {
    const office = await requireOfficeUser();
    return {
      userId: office.userId,
      userName: office.userName,
      role: office.role,
      employeeId: null,
    };
  } catch (error) {
    if (!(error instanceof OfficeAuthError)) throw error;
  }

  const field = await requireFieldManager();
  return {
    userId: field.userId,
    userName: field.userName,
    role: field.role,
    employeeId: field.foremanId,
  };
}
