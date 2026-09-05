import { NextRequest } from "next/server";
import { requireTruckDriver } from "@/lib/auth/driver-session";
import {
  OpsDeliveryNotesRepository,
  resolveDriverDnApproverIds,
} from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { isDocEditableStatus } from "@/lib/documents/sequences";

type Ctx = { params: Promise<{ id: string }> };

async function assertOwnNote(id: string, userId: string) {
  const note = await OpsDeliveryNotesRepository.getById(id);
  if (!note) throw new Error("תעודת משלוח לא נמצאה");
  if ((note as any).createdById && (note as any).createdById !== userId) {
    // mapNote may not include createdById — fetch raw
  }
  const raw = await (
    await import("@/lib/prisma")
  ).prisma.opsDeliveryNote.findFirst({
    where: { id, deletedAt: null },
    select: { createdById: true, status: true },
  });
  if (!raw) throw new Error("תעודת משלוח לא נמצאה");
  if (raw.createdById !== userId) throw new Error("אין גישה לתעודה זו");
  return { note, raw };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireTruckDriver();
    const { id } = await ctx.params;
    const { note } = await assertOwnNote(id, session.userId);
    return apiSuccess(note);
  } catch (error) {
    if (error instanceof Error) {
      if (/לא נמצאה/.test(error.message)) return apiError(error.message, 404);
      if (/אין גישה/.test(error.message)) return apiError(error.message, 403);
      return apiError(error.message, 400);
    }
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireTruckDriver();
    const { id } = await ctx.params;
    const { raw } = await assertOwnNote(id, session.userId);
    if (!isDocEditableStatus(raw.status)) {
      return apiError("ניתן לערוך רק טיוטה או תעודה שנדחתה", 400);
    }

    const body = await req.json().catch(() => ({}));
    const updated = await OpsDeliveryNotesRepository.update(id, {
      projectId: body.projectId,
      noteDate: body.noteDate ? new Date(body.noteDate) : undefined,
      noteTime: body.noteTime != null ? String(body.noteTime).slice(0, 8) : undefined,
      clientName: body.clientName != null ? String(body.clientName).trim() : undefined,
      address: body.address != null ? String(body.address) : undefined,
      vehicleNumber: body.vehicleNumber,
      driverName: body.driverName,
      notes: body.notes,
      price:
        body.price != null && body.price !== ""
          ? Number(body.price)
          : body.price === "" || body.price === null
            ? null
            : undefined,
      transportCost:
        body.transportCost != null && body.transportCost !== ""
          ? Number(body.transportCost)
          : body.transportCost === "" || body.transportCost === null
            ? null
            : undefined,
      financialNotes: body.financialNotes,
      items: Array.isArray(body.items)
        ? body.items.map((it: any) => ({
            description: String(it.description || "").trim(),
            unit: it.unit ? String(it.unit) : "יח'",
            quantity: Number(it.quantity) || 0,
            notes: it.notes ? String(it.notes) : null,
          }))
        : undefined,
      clientSignatureUrl: body.clientSignatureUrl,
      clientSignedName: body.clientSignedName,
      foremanSignatureUrl: body.foremanSignatureUrl,
      foremanSignedName: body.foremanSignedName,
      updatedById: session.userId,
    });

    if (body.submit) {
      const approverIds = await resolveDriverDnApproverIds();
      if (!approverIds.length) {
        return apiError("לא נמצאו מאשרים (מנהל מערכת / מנהל תפעול)", 400);
      }
      const submitted = await OpsDeliveryNotesRepository.submitForApproval(
        id,
        approverIds,
        session.userId
      );
      return apiSuccess(submitted);
    }

    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
