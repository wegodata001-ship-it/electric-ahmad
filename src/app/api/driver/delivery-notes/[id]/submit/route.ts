import { NextRequest } from "next/server";
import { requireTruckDriver } from "@/lib/auth/driver-session";
import {
  OpsDeliveryNotesRepository,
  resolveDriverDnApproverIds,
} from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { isDocEditableStatus } from "@/lib/documents/sequences";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireTruckDriver();
    const { id } = await ctx.params;
    const raw = await prisma.opsDeliveryNote.findFirst({
      where: { id, deletedAt: null },
      select: { createdById: true, status: true },
    });
    if (!raw) return apiError("תעודת משלוח לא נמצאה", 404);
    if (raw.createdById !== session.userId) {
      return apiError("אין גישה לתעודה זו", 403);
    }
    if (!isDocEditableStatus(raw.status)) {
      return apiError("לא ניתן לשלוח לאישור במצב הנוכחי", 400);
    }

    const approverIds = await resolveDriverDnApproverIds();
    if (!approverIds.length) {
      return apiError("לא נמצאו מאשרים (מנהל מערכת / מנהל תפעול)", 400);
    }

    const note = await OpsDeliveryNotesRepository.submitForApproval(
      id,
      approverIds,
      session.userId
    );
    return apiSuccess(note);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
