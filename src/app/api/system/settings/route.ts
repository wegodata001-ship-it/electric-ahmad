import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { requireFieldManager } from "@/lib/auth/field-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  ATTENDANCE_POLICY_KEY,
  parseAttendancePolicy,
  type AttendancePolicy,
} from "@/lib/settings/attendance-policy";

function configTable() {
  return (prisma as unknown as { appConfig?: typeof prisma & { findUnique: Function; upsert: Function } }).appConfig;
}

export async function GET() {
  try {
    try {
      await requireFieldManager();
    } catch {
      await requireOfficeUser();
    }
    const table = configTable() as any;
    if (!table) {
      return apiSuccess({ attendancePolicy: "optional" as AttendancePolicy });
    }
    const row = await table.findUnique({
      where: { key: ATTENDANCE_POLICY_KEY },
    });
    return apiSuccess({
      attendancePolicy: parseAttendancePolicy(row?.value),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    if (!isSystemAdminRole(session.role)) {
      return apiError("רק מנהל מערכת יכול לשנות הגדרות אלה", 403);
    }
    const body = await req.json().catch(() => ({}));
    const policy = parseAttendancePolicy(
      body.attendancePolicy
    ) as AttendancePolicy;

    const table = configTable() as any;
    if (!table) {
      return apiError(
        "יש להפעיל מחדש את השרת (npm run dev) כדי לטעון הגדרות מערכת",
        503
      );
    }

    await table.upsert({
      where: { key: ATTENDANCE_POLICY_KEY },
      create: { key: ATTENDANCE_POLICY_KEY, value: policy },
      update: { value: policy },
    });

    return apiSuccess({ attendancePolicy: policy });
  } catch (error) {
    return handleApiError(error);
  }
}
