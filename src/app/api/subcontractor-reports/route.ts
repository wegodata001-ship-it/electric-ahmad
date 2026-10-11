import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireSubcontractorOfficeAction } from "@/lib/auth/subcontractor-permissions";
import { PROJECT_MANAGER_ROLE } from "@/lib/auth/roles";
import { listProjectsForRole } from "@/lib/auth/project-access";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

export async function GET(_req: NextRequest) {
  try {
    const session = await requireSubcontractorOfficeAction("review_measurements");
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
    const items = await SubcontractorsRepository.listPendingReports(projectIds);
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
