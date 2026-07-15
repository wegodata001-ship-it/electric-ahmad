import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  FIELD_SESSION_COOKIE,
  verifyFieldSession,
  type FieldSessionPayload,
} from "@/lib/auth/field-cookie";
import { FIELD_MANAGER_ROLE, isFieldManagerRole } from "@/lib/auth/roles";

export type FieldForemanSession = {
  userId: string;
  userName: string;
  username: string;
  foremanId: string;
  foremanName: string;
  phone: string;
  role: typeof FIELD_MANAGER_ROLE;
};

export class FieldAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "FieldAuthError";
    this.status = status;
  }
}

export async function readFieldSessionPayload(): Promise<FieldSessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(FIELD_SESSION_COOKIE)?.value;
  return verifyFieldSession(token);
}

/**
 * Require authenticated FIELD_MANAGER linked to an active Employee (foreman).
 * No env fallbacks — isolation by logged-in user only.
 */
export async function requireFieldManager(): Promise<FieldForemanSession> {
  const payload = await readFieldSessionPayload();
  if (!payload) {
    throw new FieldAuthError("נדרשת התחברות למערכת מנהל העבודה", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { employee: true },
  });

  if (!user || !isFieldManagerRole(user.role)) {
    throw new FieldAuthError("אין הרשאת מנהל עבודה", 403);
  }
  if (!user.passwordHash || !user.username) {
    throw new FieldAuthError("חשבון המשתמש אינו מוגדר להתחברות", 403);
  }

  const employee = user.employee;
  if (!employee || employee.id !== payload.employeeId) {
    throw new FieldAuthError("משתמש אינו מקושר למנהל עבודה", 403);
  }
  if (employee.isDeleted) {
    throw new FieldAuthError("חשבון מנהל העבודה נמחק", 403);
  }
  if (employee.status !== "active") {
    throw new FieldAuthError("מנהל העבודה אינו פעיל", 403);
  }

  return {
    userId: user.id,
    userName: user.name,
    username: user.username,
    foremanId: employee.id,
    foremanName: `${employee.firstName} ${employee.lastName}`,
    phone: employee.phone,
    role: FIELD_MANAGER_ROLE,
  };
}

/** @deprecated use requireFieldManager */
export async function getCurrentFieldForeman(): Promise<FieldForemanSession> {
  return requireFieldManager();
}

/** Field managers belong to the company — any active project may be selected. */
export async function assertProjectSelectable(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true },
  });
  if (!project) {
    throw new FieldAuthError("פרויקט לא נמצא", 404);
  }
  if (project.status !== "active" && project.status !== "planning") {
    throw new FieldAuthError("הפרויקט אינו זמין לדיווח", 403);
  }
}
