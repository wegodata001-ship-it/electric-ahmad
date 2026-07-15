import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { isFieldManagerRole } from "@/lib/auth/roles";
import {
  FIELD_SESSION_COOKIE,
  fieldSessionCookieOptions,
  signFieldSession,
} from "@/lib/auth/field-cookie";
import { AuditRepository } from "@/repositories/audit.repository";
import { apiError, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return apiError("יש להזין שם משתמש וסיסמה");
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { employee: true },
    });

    if (
      !user ||
      !user.passwordHash ||
      !isFieldManagerRole(user.role) ||
      !user.employee
    ) {
      return apiError("שם משתמש או סיסמה שגויים", 401);
    }

    if (user.employee.isDeleted) {
      return apiError("חשבון מנהל העבודה נמחק", 403);
    }
    if (user.employee.status !== "active") {
      return apiError("המשתמש אינו פעיל", 403);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return apiError("שם משתמש או סיסמה שגויים", 401);
    }

    const token = await signFieldSession({
      userId: user.id,
      employeeId: user.employee.id,
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "FieldAuth",
      entityId: user.employee.id,
      userId: user.id,
      metadata: {
        action: "login",
        managerId: user.employee.id,
        userId: user.id,
        datetime: new Date().toISOString(),
      },
    });

    const res = NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        employeeId: user.employee.id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
    res.cookies.set(FIELD_SESSION_COOKIE, token, fieldSessionCookieOptions());
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}
