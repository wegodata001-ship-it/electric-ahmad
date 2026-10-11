import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import {
  canViewBankDetails,
  requireSubcontractorOfficeAction,
} from "@/lib/auth/subcontractor-permissions";
import { PROJECT_MANAGER_ROLE } from "@/lib/auth/roles";
import { listProjectsForRole } from "@/lib/auth/project-access";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

export async function GET(req: NextRequest) {
  try {
    const session = await requireOfficeAuth();
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const status = req.nextUrl.searchParams.get("status") || undefined;
    const projectId = req.nextUrl.searchParams.get("projectId") || undefined;
    const userStatus = req.nextUrl.searchParams.get("userStatus") || undefined;
    const projectIds =
      session.role === PROJECT_MANAGER_ROLE
        ? (
            await listProjectsForRole({
              userId: session.userId,
              role: session.role,
              mode: "assigned",
            })
          ).map((p) => p.id)
        : undefined;
    const [items, summary] = await Promise.all([
      SubcontractorsRepository.list({ q, status, projectId, projectIds, userStatus }),
      SubcontractorsRepository.summary(projectIds),
    ]);
    return apiSuccess({ items, summary });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSubcontractorOfficeAction("manage_registry");
    const body = await req.json();
    const created = await SubcontractorsRepository.create(body, session.userId);
    return apiSuccess({
      ...created,
      bankDetails: canViewBankDetails(session.role) ? created.bankDetails : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
