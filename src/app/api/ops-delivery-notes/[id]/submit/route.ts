import { after, NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { hasDocumentPermission } from "@/lib/auth/document-permissions";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { assertCanAccessOwnedWdOrDn } from "@/lib/auth/cross-project-documents";
import { prisma } from "@/lib/prisma";
import { createAfterScheduler } from "@/lib/async/schedule-background";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    if (!hasDocumentPermission(session.role, "send_for_approval")) {
      return apiError("אין הרשאה לשליחה לאישור", 403);
    }
    const { id } = await ctx.params;
    const existing = await prisma.opsDeliveryNote.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        projectId: true,
        createdById: true,
        documentNumber: true,
        status: true,
      },
    });
    if (!existing) return apiError("תעודת משלוח לא נמצאה", 404);
    await assertCanAccessOwnedWdOrDn(
      session,
      existing,
      "send_for_approval"
    );
    const body = await req.json();
    const approverIds: string[] = Array.isArray(body.approverIds)
      ? body.approverIds.map(String)
      : [];

    const schedule = createAfterScheduler(after, "dn-submit");
    const note = await OpsDeliveryNotesRepository.submitForApproval(
      id,
      approverIds,
      session.userId,
      schedule
    );
    return apiSuccess(note);
  } catch (error) {
    return handleApiError(error);
  }
}
