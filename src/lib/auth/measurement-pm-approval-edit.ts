import { prisma } from "@/lib/prisma";
import { userCanAccessProject } from "@/lib/auth/project-access";
import { PROJECT_MANAGER_ROLE } from "@/lib/auth/roles";

export class PmApprovalEditError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "PmApprovalEditError";
    this.status = status;
  }
}

export type PmPendingSheetGate = {
  id: string;
  projectId: string;
  status: string;
  currentVersion: number;
  title: string;
  sequenceNumber: number;
};

/**
 * PROJECT_MANAGER may edit a measurement sheet only while it is pending their
 * approval, on a project they own, and before any final/locked status.
 */
export async function assertProjectManagerPendingEdit(opts: {
  userId: string;
  role: string;
  sheetId: string;
  expectedVersion?: number;
}): Promise<PmPendingSheetGate> {
  if (opts.role !== PROJECT_MANAGER_ROLE) {
    throw new PmApprovalEditError(
      "רק מנהל פרויקט יכול לערוך דף מדידה בשלב אישור",
      403
    );
  }

  const sheet = await prisma.measurementSheet.findUnique({
    where: { id: opts.sheetId },
    select: {
      id: true,
      projectId: true,
      status: true,
      currentVersion: true,
      title: true,
      sequenceNumber: true,
      approvals: {
        where: { approverId: opts.userId, status: "pending" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!sheet) {
    throw new PmApprovalEditError("דף מדידה לא נמצא", 404);
  }

  if (sheet.status !== "pending_approval") {
    throw new PmApprovalEditError(
      "ניתן לערוך רק מסמך שממתין לאישור אצלך",
      403
    );
  }

  const allowed = await userCanAccessProject({
    userId: opts.userId,
    role: opts.role,
    projectId: sheet.projectId,
    scope: "manage",
  });
  if (!allowed) {
    throw new PmApprovalEditError("אין הרשאה לפרויקט זה", 403);
  }

  if (!sheet.approvals.length) {
    throw new PmApprovalEditError(
      "המסמך לא נשלח אליך לבדיקה — אין הרשאת עריכה",
      403
    );
  }

  if (
    opts.expectedVersion != null &&
    sheet.currentVersion !== opts.expectedVersion
  ) {
    throw new PmApprovalEditError(
      "המסמך עודכן מאז שפתחת אותו. יש לרענן לפני שמירת השינויים.",
      409
    );
  }

  return {
    id: sheet.id,
    projectId: sheet.projectId,
    status: sheet.status,
    currentVersion: sheet.currentVersion,
    title: sheet.title,
    sequenceNumber: sheet.sequenceNumber,
  };
}

/** Soft check for GET/UI — never throws. */
export async function canProjectManagerEditPendingSheet(opts: {
  userId: string;
  role: string;
  sheetId: string;
  projectId: string;
  status: string;
  pendingApproverIds?: string[];
}): Promise<boolean> {
  if (opts.role !== PROJECT_MANAGER_ROLE) return false;
  if (opts.status !== "pending_approval") return false;

  const allowed = await userCanAccessProject({
    userId: opts.userId,
    role: opts.role,
    projectId: opts.projectId,
    scope: "manage",
  });
  if (!allowed) return false;

  if (opts.pendingApproverIds) {
    return opts.pendingApproverIds.includes(opts.userId);
  }

  const pending = await prisma.measurementSheetApproval.findFirst({
    where: {
      sheetId: opts.sheetId,
      approverId: opts.userId,
      status: "pending",
    },
    select: { id: true },
  });
  return Boolean(pending);
}
