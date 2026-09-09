import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import {
  assertCanAccessOwnedWdOrDn,
} from "@/lib/auth/cross-project-documents";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

async function loadAuthorized(
  id: string,
  permission: "view_all" | "edit_draft" | "delete"
) {
  const session = await requireOfficeUser();
  const note = await OpsDeliveryNotesRepository.getById(id);
  if (!note) return { session, note: null };
  await assertCanAccessOwnedWdOrDn(session, note, permission);
  return { session, note };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { note } = await loadAuthorized(id, "view_all");
    if (!note) return apiError("תעודת משלוח לא נמצאה", 404);
    return apiSuccess(note);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { session, note: existing } = await loadAuthorized(id, "edit_draft");
    if (!existing) return apiError("תעודת משלוח לא נמצאה", 404);
    const body = await req.json();
    if (body.projectId && body.projectId !== existing.projectId) {
      return apiError("לא ניתן לשנות פרויקט לאחר יצירת תעודת משלוח", 400);
    }
    if (
      body.expectedVersion != null &&
      Number(body.expectedVersion) !== existing.currentVersion
    ) {
      return apiError("המסמך עודכן מאז שפתחת אותו. יש לרענן.", 409);
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
      updatedById: session.userId,
    });
    return apiSuccess(note);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { session, note } = await loadAuthorized(id, "delete");
    if (!note) return apiError("תעודת משלוח לא נמצאה", 404);
    await OpsDeliveryNotesRepository.softDelete(id, session.userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
