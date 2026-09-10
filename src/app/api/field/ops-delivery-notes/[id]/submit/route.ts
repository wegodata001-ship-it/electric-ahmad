import { after, NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { createAfterScheduler } from "@/lib/async/schedule-background";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await ctx.params;
    const existing = await prisma.opsDeliveryNote.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, foremanId: true },
    });
    if (!existing) return apiError("תעודת משלוח לא נמצאה", 404);
    if (existing.foremanId !== session.foremanId) return apiError("אין הרשאה", 403);

    const body = await req.json();
    const approverIds: string[] = Array.isArray(body.approverIds)
      ? body.approverIds.map(String)
      : [];

    const schedule = createAfterScheduler(after, "field-dn-submit");
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
