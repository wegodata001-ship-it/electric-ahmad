import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  OFFICE_SESSION_COOKIE,
  verifyOfficeSession,
  type OfficeSessionPayload,
} from "@/lib/auth/office-cookie";
import { isOfficeRole, officeRoleLabel } from "@/lib/auth/roles";

export type OfficeUserSession = {
  userId: string;
  userName: string;
  email: string;
  username: string | null;
  role: string;
  roleLabel: string;
  avatarUrl: string;
  employeeId: string | null;
};

export class OfficeAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "OfficeAuthError";
    this.status = status;
  }
}

export async function readOfficeSessionPayload(): Promise<OfficeSessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(OFFICE_SESSION_COOKIE)?.value;
  return verifyOfficeSession(token);
}

/**
 * Require authenticated office / project-manager user.
 * Validates role, active employee (when linked), and soft-delete.
 * Uses a slim select (no full Employee row) — same security checks, 1 RTT.
 */
export async function requireOfficeUser(): Promise<OfficeUserSession> {
  const payload = await readOfficeSessionPayload();
  if (!payload) {
    throw new OfficeAuthError("נדרשת התחברות למערכת", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      avatarUrl: true,
      passwordHash: true,
      employee: {
        select: {
          id: true,
          isDeleted: true,
          status: true,
        },
      },
    },
  });

  if (!user || !user.passwordHash || !isOfficeRole(user.role)) {
    throw new OfficeAuthError("אין הרשאת מנהל פרויקט", 403);
  }

  if (user.employee) {
    if (user.employee.isDeleted) {
      throw new OfficeAuthError("החשבון נמחק", 403);
    }
    if (user.employee.status !== "active") {
      throw new OfficeAuthError("המשתמש אינו פעיל", 403);
    }
  }

  return {
    userId: user.id,
    userName: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    roleLabel: officeRoleLabel(user.role),
    avatarUrl: user.avatarUrl ?? "",
    employeeId: user.employee?.id ?? null,
  };
}
