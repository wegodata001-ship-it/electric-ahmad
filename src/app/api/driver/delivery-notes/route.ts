import { NextRequest } from "next/server";
import {
  assertDriverProjectSelectable,
  requireTruckDriver,
} from "@/lib/auth/driver-session";
import { OfficeAuthError } from "@/lib/auth/office-session";
import {
  OpsDeliveryNotesRepository,
  ensureDriverEmployee,
  resolveDriverDnApproverIds,
} from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { OpsDeliveryNoteStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await requireTruckDriver();
    const status = req.nextUrl.searchParams.get(
      "status"
    ) as OpsDeliveryNoteStatus | null;
    const items = await OpsDeliveryNotesRepository.list({
      createdById: session.userId,
      status: status || undefined,
      take: 100,
    });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireTruckDriver();
    const body = await req.json().catch(() => ({}));
    if (!body.clientName?.trim() && !body.address?.trim()) {
      return apiError("יש להזין יעד / שם מקבל");
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return apiError("יש להוסיף לפחות פריט אחד");
    }
    if (body.projectId) {
      await assertDriverProjectSelectable(String(body.projectId));
    }

    const foremanId = await ensureDriverEmployee({
      userId: session.userId,
      name: session.userName,
      email: session.email,
    });

    const note = await OpsDeliveryNotesRepository.create({
      projectId: body.projectId || null,
      foremanId,
      noteDate: body.noteDate ? new Date(body.noteDate) : new Date(),
      noteTime: body.noteTime ? String(body.noteTime).slice(0, 8) : null,
      clientName: String(body.clientName || body.address || "יעד").trim(),
      address: body.address ? String(body.address).trim() : null,
      vehicleNumber: body.vehicleNumber ? String(body.vehicleNumber) : null,
      driverName: body.driverName
        ? String(body.driverName)
        : session.userName,
      notes: body.notes ? String(body.notes) : null,
      price:
        body.price != null && body.price !== ""
          ? Number(body.price)
          : null,
      transportCost:
        body.transportCost != null && body.transportCost !== ""
          ? Number(body.transportCost)
          : null,
      financialNotes: body.financialNotes
        ? String(body.financialNotes)
        : null,
      items: body.items.map((it: any) => ({
        description: String(it.description || "").trim(),
        unit: it.unit ? String(it.unit) : "יח'",
        quantity: Number(it.quantity) || 0,
        notes: it.notes ? String(it.notes) : null,
      })),
      clientSignatureUrl: body.clientSignatureUrl || null,
      clientSignedName: body.clientSignedName || null,
      foremanSignatureUrl: body.foremanSignatureUrl || null,
      foremanSignedName: body.foremanSignedName || session.userName,
      createdById: session.userId,
    });

    const submit = Boolean(body.submit);
    if (submit) {
      const approverIds = await resolveDriverDnApproverIds();
      if (!approverIds.length) {
        return apiError("לא נמצאו מאשרים (מנהל מערכת / מנהל תפעול)", 400);
      }
      const submitted = await OpsDeliveryNotesRepository.submitForApproval(
        note.id,
        approverIds,
        session.userId
      );
      return apiSuccess(submitted, 201);
    }

    return apiSuccess(note, 201);
  } catch (error) {
    if (error instanceof OfficeAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
