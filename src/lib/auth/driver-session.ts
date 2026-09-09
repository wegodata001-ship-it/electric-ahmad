import {
  requireOfficeUser,
  OfficeAuthError,
  type OfficeUserSession,
} from "@/lib/auth/office-session";
import { isTruckDriverRole } from "@/lib/auth/driver-permissions";
import { prisma } from "@/lib/prisma";

export async function requireTruckDriver(): Promise<OfficeUserSession> {
  const session = await requireOfficeUser();
  if (!isTruckDriverRole(session.role)) {
    throw new OfficeAuthError("גישה לנהגים בלבד", 403);
  }
  return session;
}

export async function assertDriverProjectSelectable(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, status: "active", deletedAt: null },
    select: { id: true },
  });
  if (!project) {
    throw new OfficeAuthError("הפרויקט אינו זמין לנהג", 403);
  }
}
