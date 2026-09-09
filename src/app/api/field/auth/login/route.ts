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
import { parseJsonBody } from "@/lib/validation/parse-body";
import { fieldLoginSchema } from "@/lib/validation/schemas";
import {
  enforceRateLimit,
  getClientIp,
  logFailedLogin,
} from "@/lib/security/rate-limit";

const LOGIN_BUCKET = "field-auth-login";
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const limited = enforceRateLimit(
    {
      key: `${LOGIN_BUCKET}:${ip}`,
      limit: LOGIN_LIMIT,
      windowMs: LOGIN_WINDOW_MS,
    },
    "יותר מדי ניסיונות התחברות. נסו שוב בעוד מספר דקות."
  );
  if (limited) return limited;

  try {
    const body = await parseJsonBody(request, fieldLoginSchema);
    const username = body.username.trim().toLowerCase();
    const password = body.password;

    if (!username || !password) {
      return apiError("יש להזין שם משתמש וסיסמה");
    }

    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      include: { employee: true },
    });

    if (
      !user ||
      !user.passwordHash ||
      !isFieldManagerRole(user.role) ||
      !user.employee
    ) {
      logFailedLogin({
        bucket: LOGIN_BUCKET,
        ip,
        identifier: username,
        reason: "unknown-or-non-field",
      });
      return apiError("שם משתמש או סיסמה שגויים", 401);
    }

    if (user.employee.isDeleted) {
      logFailedLogin({
        bucket: LOGIN_BUCKET,
        ip,
        identifier: username,
        reason: "account-deleted",
      });
      return apiError("חשבון מנהל העבודה נמחק", 403);
    }
    if (user.employee.status !== "active") {
      logFailedLogin({
        bucket: LOGIN_BUCKET,
        ip,
        identifier: username,
        reason: "inactive",
      });
      return apiError("המשתמש אינו פעיל", 403);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      logFailedLogin({
        bucket: LOGIN_BUCKET,
        ip,
        identifier: username,
        reason: "bad-password",
      });
      return apiError("שם משתמש או סיסמה שגויים", 401);
    }

    if (user.status !== "ACTIVE") {
      logFailedLogin({
        bucket: LOGIN_BUCKET,
        ip,
        identifier: username,
        reason: `user-${user.status.toLowerCase()}`,
      });
      return apiError("המשתמש אינו פעיל", 403);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await signFieldSession({
      userId: user.id,
      employeeId: user.employee.id,
      sessionVersion: user.sessionVersion,
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
