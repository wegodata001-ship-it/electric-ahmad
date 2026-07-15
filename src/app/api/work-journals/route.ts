import { NextRequest } from "next/server";
import {
  assertProjectSelectable,
  FieldAuthError,
  requireFieldManager,
} from "@/lib/auth/field-session";
import { getAuthContext } from "@/lib/auth/session";
import { WorkJournalsRepository } from "@/repositories/work-journals.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { AuditRepository } from "@/repositories/audit.repository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");
    const foremanId = searchParams.get("foremanId") ?? undefined;
    const projectId = searchParams.get("projectId") ?? undefined;
    const status = searchParams.get("status") as
      | "draft"
      | "submitted"
      | null;

    if (scope === "office") {
      await getAuthContext();
      const list = await WorkJournalsRepository.listForOffice({
        foremanId,
        projectId,
        status: status ?? undefined,
      });
      return apiSuccess(list);
    }

    const session = await requireFieldManager();
    const list = await WorkJournalsRepository.listForForeman(
      session.foremanId
    );
    return apiSuccess(list);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireFieldManager();
    const body = await request.json();
    if (!body.projectId || !body.date) {
      return apiError("פרויקט ותאריך חובה");
    }
    await assertProjectSelectable(body.projectId);

    const journal = await WorkJournalsRepository.createDraft(
      session.foremanId,
      {
        projectId: body.projectId,
        date: body.date,
        clientName: body.clientName,
        address: body.address,
        workArea: body.workArea,
        generalNotes: body.generalNotes,
        actionsPerformed: body.actionsPerformed,
        exceptions: body.exceptions,
        equipment: body.equipment,
        notes: body.notes,
        signatureData: body.signatureData,
        status: body.status === "in_progress" ? "in_progress" : "draft",
        workers: body.workers,
        lines: body.lines,
      },
      session.userId
    );

    await AuditRepository.log({
      action: "CREATE",
      entityType: "WorkJournal",
      entityId: journal.id,
      userId: session.userId,
      metadata: {
        managerId: session.foremanId,
        projectId: body.projectId,
        userId: session.userId,
        datetime: new Date().toISOString(),
      },
    });

    return apiSuccess(journal, 201);
  } catch (error) {
    if (error instanceof FieldAuthError) return handleApiError(error);
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
