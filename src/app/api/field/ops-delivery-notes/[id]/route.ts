import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await ctx.params;
    const note = await OpsDeliveryNotesRepository.getById(id);
    if (!note) return apiError("תעודת משלוח לא נמצאה", 404);
    if (note.foremanId !== session.foremanId) return apiError("אין הרשאה", 403);
    return apiSuccess(note);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await ctx.params;
    const existing = await OpsDeliveryNotesRepository.getById(id);
    if (!existing) return apiError("תעודת משלוח לא נמצאה", 404);
    if (existing.foremanId !== session.foremanId) return apiError("אין הרשאה", 403);

    const body = await req.json();
    if (
      body.expectedVersion != null &&
      Number(body.expectedVersion) !== existing.currentVersion
    ) {
      return apiError(
        "המסמך עודכן מאז שפתחת אותו. יש לרענן לפני שמירת השינויים.",
        409
      );
    }
    const note = await OpsDeliveryNotesRepository.update(id, {
      projectId: body.projectId,
      noteDate: body.noteDate ? new Date(body.noteDate) : undefined,
      clientName: body.clientName,
      address: body.address,
      vehicleNumber: body.vehicleNumber,
      driverName: body.driverName,
      notes: body.notes,
      items: body.items,
      foremanSignatureUrl: body.foremanSignatureUrl,
      foremanSignedName: body.foremanSignedName,
      updatedById: session.userId,
    });
    return apiSuccess(note);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await ctx.params;
    const existing = await OpsDeliveryNotesRepository.getById(id);
    if (!existing) return apiError("תעודת משלוח לא נמצאה", 404);
    if (existing.foremanId !== session.foremanId) return apiError("אין הרשאה", 403);
    await OpsDeliveryNotesRepository.softDelete(id, session.userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
