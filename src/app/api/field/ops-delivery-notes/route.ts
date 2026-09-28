import { NextRequest } from "next/server";
import {
  assertProjectSelectable,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { peekNextDocumentNumber } from "@/lib/documents/sequences";
import type { OpsDeliveryNoteStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await requireFieldManager();
    const status = req.nextUrl.searchParams.get("status") as OpsDeliveryNoteStatus | null;
    if (req.nextUrl.searchParams.get("peekNumber") === "1") {
      return apiSuccess({ documentNumber: await peekNextDocumentNumber("delivery_note") });
    }
    const items = await OpsDeliveryNotesRepository.list({
      foremanId: session.foremanId,
      status: status || undefined,
    });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireFieldManager();
    const body = await req.json();
    if (!body.clientName?.trim()) return apiError("יש להזין שם לקוח");
    if (body.projectId) {
      await assertProjectSelectable(String(body.projectId), session.foremanId);
    }

    const note = await OpsDeliveryNotesRepository.create({
      projectId: body.projectId || null,
      foremanId: session.foremanId,
      noteDate: body.noteDate ? new Date(body.noteDate) : new Date(),
      noteTime: body.noteTime ? String(body.noteTime).slice(0, 8) : null,
      clientName: String(body.clientName).trim(),
      address: body.address,
      vehicleNumber: body.vehicleNumber,
      driverName: body.driverName,
      notes: body.notes,
      items: Array.isArray(body.items) ? body.items : [],
      foremanSignatureUrl: body.foremanSignatureUrl,
      foremanSignedName: body.foremanSignedName ?? session.foremanName,
      createdById: session.userId,
    });

    return apiSuccess(note, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
