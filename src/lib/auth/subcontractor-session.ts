import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  SUBCONTRACTOR_SESSION_COOKIE,
  verifySubcontractorSession,
  type SubcontractorSessionPayload,
} from "@/lib/auth/subcontractor-cookie";
import { SUBCONTRACTOR_ROLE, isSubcontractorRole } from "@/lib/auth/roles";

export type SubcontractorPortalRole = "owner" | "worker";

export type SubcontractorUserSession = {
  userId: string;
  userName: string;
  email: string;
  username: string | null;
  role: typeof SUBCONTRACTOR_ROLE;
  portalRole: SubcontractorPortalRole;
  canViewFinance: boolean;
  subcontractorId: string;
  companyName: string;
  membershipId: string;
};

export class SubcontractorAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "SubcontractorAuthError";
    this.status = status;
  }
}

export async function readSubcontractorSessionPayload(): Promise<SubcontractorSessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SUBCONTRACTOR_SESSION_COOKIE)?.value;
  return verifySubcontractorSession(token);
}

export async function requireSubcontractorUser(): Promise<SubcontractorUserSession> {
  const payload = await readSubcontractorSessionPayload();
  if (!payload) {
    throw new SubcontractorAuthError("נדרשת התחברות לפורטל קבלן המשנה", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      status: true,
      sessionVersion: true,
      passwordHash: true,
      subcontractorMembership: {
        select: {
          id: true,
          status: true,
          portalRole: true,
          subcontractorId: true,
          subcontractor: { select: { id: true, companyName: true, status: true } },
        },
      },
    },
  });

  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.sessionVersion !== (payload.sessionVersion ?? 0) ||
    !user.passwordHash ||
    !isSubcontractorRole(user.role)
  ) {
    throw new SubcontractorAuthError("אין הרשאת קבלן משנה", 403);
  }

  const membership = user.subcontractorMembership;
  if (
    !membership ||
    membership.status !== "active" ||
    membership.subcontractorId !== payload.subcontractorId ||
    membership.subcontractor.status !== "active"
  ) {
    throw new SubcontractorAuthError("הגישה לקבלן המשנה אינה פעילה", 403);
  }

  const portalRole: SubcontractorPortalRole =
    membership.portalRole === "worker" ? "worker" : "owner";

  return {
    userId: user.id,
    userName: user.name,
    email: user.email,
    username: user.username,
    role: SUBCONTRACTOR_ROLE,
    portalRole,
    canViewFinance: portalRole === "owner",
    subcontractorId: membership.subcontractorId,
    companyName: membership.subcontractor.companyName,
    membershipId: membership.id,
  };
}

export function requireSubcontractorFinance(session: SubcontractorUserSession) {
  if (!session.canViewFinance) {
    throw new SubcontractorAuthError("אין הרשאה לנתונים כספיים", 403);
  }
}
