import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { isOfficeRole } from "@/lib/auth/roles";
import {
  OFFICE_SESSION_COOKIE,
  OFFICE_SESSION_REMEMBER_TTL_SECONDS,
  OFFICE_SESSION_TTL_SECONDS,
  officeSessionCookieOptions,
  signOfficeSession,
} from "@/lib/auth/office-cookie";
import { AuditRepository } from "@/repositories/audit.repository";
import { apiError, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = String(body.username ?? body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const rememberMe = Boolean(body.rememberMe);

    if (!identifier || !password) {
      return apiError("יש להזין שם משתמש/אימייל וסיסמה");
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: "insensitive" } },
          { email: { equals: identifier, mode: "insensitive" } },
        ],
      },
      include: { employee: true },
    });

    if (!user || !user.passwordHash) {
      return apiError("שם משתמש או סיסמה שגויים", 401);
    }

    if (!isOfficeRole(user.role)) {
      if (user.role === "FIELD_MANAGER") {
        return apiError(
          "חשבון זה מיועד לאפליקציית שטח — היכנס דרך /field/login",
          401
        );
      }
      return apiError("אין הרשאת מנהל פרויקט לחשבון זה", 401);
    }

    if (user.employee) {
      if (user.employee.isDeleted) {
        return apiError("החשבון נמחק", 403);
      }
      if (user.employee.status !== "active") {
        return apiError("המשתמש אינו פעיל", 403);
      }
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return apiError("שם משתמש או סיסמה שגויים", 401);
    }

    const ttl = rememberMe
      ? OFFICE_SESSION_REMEMBER_TTL_SECONDS
      : OFFICE_SESSION_TTL_SECONDS;

    const token = await signOfficeSession({
      userId: user.id,
      role: user.role,
      ttlSeconds: ttl,
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "OfficeAuth",
      entityId: user.id,
      userId: user.id,
      metadata: {
        action: "login",
        rememberMe,
        datetime: new Date().toISOString(),
      },
    });

    const res = NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
    res.cookies.set(
      OFFICE_SESSION_COOKIE,
      token,
      officeSessionCookieOptions(ttl)
    );
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}
