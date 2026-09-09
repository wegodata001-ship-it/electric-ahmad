import { NextRequest } from "next/server";
import {
  requirePermission,
  requireProjectPermission,
} from "@/lib/auth/assert-office";
import { DocumentsHubRepository } from "@/repositories/documents-hub.repository";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { assertCanAccessOwnedWdOrDn } from "@/lib/auth/cross-project-documents";
import {
  canSeeAllProjects,
  userCanAccessProject,
} from "@/lib/auth/project-access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ kind: string; id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requirePermission("view_all");
    const { kind, id } = await ctx.params;
    const detail = await DocumentsHubRepository.getDetail(kind, id);
    if (!detail) return apiError("מסמך לא נמצא", 404);
    const projectId = detail.list?.projectId;
    if (!projectId) return apiError("למסמך אין פרויקט", 404);
    if (kind === "work_diary" || kind === "delivery_note") {
      const entity =
        kind === "work_diary"
          ? await WorkDiariesRepository.getById(id)
          : await OpsDeliveryNotesRepository.getById(id);
      if (!entity) return apiError("מסמך לא נמצא", 404);
      await assertCanAccessOwnedWdOrDn(session, entity, "view_all");
      const projectWide =
        canSeeAllProjects(session.role) ||
        (await userCanAccessProject({
          userId: session.userId,
          role: session.role,
          projectId,
        }));
      if (!projectWide) {
        return apiSuccess({
          ...detail,
          related: { documents: [], photos: [] },
        });
      }
    } else {
      await requireProjectPermission("view_all", projectId);
    }
    return apiSuccess(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
