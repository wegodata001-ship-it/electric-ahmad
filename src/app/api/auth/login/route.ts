import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { isFieldManagerRole, isOfficeRole } from "@/lib/auth/roles";
import { portalHomeForRole } from "@/lib/portals/config";
import {
  OFFICE_SESSION_COOKIE,
  OFFICE_SESSION_REMEMBER_TTL_SECONDS,
  OFFICE_SESSION_TTL_SECONDS,
  officeSessionCookieOptions,
  signOfficeSession,
} from "@/lib/auth/office-cookie";
import {
  FIELD_SESSION_COOKIE,
  fieldSessionCookieOptions,
  signFieldSession,
} from "@/lib/auth/field-cookie";
import { AuditRepository } from "@/repositories/audit.repository";
import { apiError, handleApiError } from "@/lib/api/response";

/** Unified login — one screen, portal redirect by role */
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

    const portalPath = portalHomeForRole(user.role);
    if (portalPath === "/login") {
      return apiError("אין Portal מוגדר לתפקיד זה", 403);
    }

    // Field → field session
    if (isFieldManagerRole(user.role)) {
      if (!user.employee) {
        return apiError("חשבון שטח אינו מקושר לעובד", 403);
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
          portal: "field",
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
          portalPath,
        },
      });
      res.cookies.set(FIELD_SESSION_COOKIE, token, fieldSessionCookieOptions());
      return res;
    }

    if (!isOfficeRole(user.role)) {
      return apiError("אין הרשאה להתחברות", 401);
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
        portal: portalPath,
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
        portalPath,
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
