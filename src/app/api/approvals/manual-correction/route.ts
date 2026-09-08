import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { canApproveDocuments } from "@/lib/auth/document-permissions";
import { userCanAccessProject } from "@/lib/auth/project-access";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { AuditRepository } from "@/repositories/audit.repository";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";

type CorrectionKind = "work_diary" | "delivery_note";

function changedValues(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { before: before[key] ?? null, after: after[key] ?? null };
    }
  }
  return changes;
}

function changeSummary(changes: Record<string, unknown>) {
  const keys = Object.keys(changes);
  const labels: Record<string, string> = {
    clientName: "לקוח",
    address: "כתובת",
    vehicleNumber: "מספר רכב",
    driverName: "נהג",
    weather: "מזג אוויר",
    workType: "סוג עבודה",
    workSummary: "תיאור העבודה",
    notes: "הערות",
    items: "פריטי התעודה",
    workItems: "פירוט העבודה",
    workers: "עובדים ושעות",
  };
  return keys.length
    ? keys.map((key) => labels[key] || key).join(", ")
    : "ללא שינוי בנתונים";
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאה לבצע תיקון ידני", 403);
    }

    const body = await req.json();
    const kind = body.kind as CorrectionKind;
    const documentId = String(body.documentId || "");
    const expectedVersion = Number(body.expectedVersion);
    const data = body.data && typeof body.data === "object" ? body.data : {};

    if (!documentId || !["work_diary", "delivery_note"].includes(kind)) {
      return apiError("פרטי מסמך לא תקינים", 400);
    }

    if (kind === "delivery_note") {
      const existing = await OpsDeliveryNotesRepository.getById(documentId);
      if (!existing) return apiError("תעודת משלוח לא נמצאה", 404);
      const rejectedByActor = existing.approvals.some(
        (approval: {
          status: string;
          approver?: { id?: string | null } | null;
        }) =>
          approval.status === "rejected" &&
          approval.approver?.id === session.userId
      );
      if (existing.status !== "revision" || !rejectedByActor) {
        return apiError("אין הרשאה לערוך תיקון זה", 403);
      }
      if (
        !(await userCanAccessProject({
          userId: session.userId,
          role: session.role,
          projectId: existing.projectId,
          scope: "operational",
        }))
      ) {
        return apiError("אין הרשאה לפרויקט זה", 403);
      }
      if (
        Number.isFinite(expectedVersion) &&
        expectedVersion !== existing.currentVersion
      ) {
        return apiError(
          "המסמך עודכן מאז שפתחת אותו. יש לרענן לפני שמירת השינויים.",
          409
        );
      }

      const before = {
        clientName: existing.clientName,
        address: existing.address,
        vehicleNumber: existing.vehicleNumber,
        driverName: existing.driverName,
        notes: existing.notes,
        items: existing.items.map((item: {
          description: string;
          unit: string;
          quantity: number;
          notes?: string | null;
        }) => ({
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          notes: item.notes,
        })),
      };
      const requested = {
        clientName: String(data.clientName ?? existing.clientName).trim(),
        address: data.address == null ? null : String(data.address),
        vehicleNumber:
          data.vehicleNumber == null ? null : String(data.vehicleNumber),
        driverName: data.driverName == null ? null : String(data.driverName),
        notes: data.notes == null ? null : String(data.notes),
        items: Array.isArray(data.items)
          ? data.items.map((item: Record<string, unknown>) => ({
              description: String(item.description || "").trim(),
              unit: String(item.unit || "יח'"),
              quantity: Number(item.quantity) || 0,
              notes: item.notes == null ? null : String(item.notes),
            }))
          : existing.items,
      };
      if (!requested.clientName) return apiError("יש להזין שם לקוח", 400);

      const changes = changedValues(before, requested);
      const updated = await OpsDeliveryNotesRepository.update(documentId, {
        ...requested,
        updatedById: session.userId,
      });
      await prisma.opsDeliveryNoteEvent.create({
        data: {
          opsDeliveryNoteId: documentId,
          action: "manual_correction",
          message: `בוצע תיקון ידני. שונו: ${changeSummary(changes)}`,
          actorId: session.userId,
          metadata: JSON.stringify({ changes }),
        },
      });
      await AuditRepository.log({
        action: "UPDATE",
        entityType: "OpsDeliveryNote",
        entityId: documentId,
        userId: session.userId,
        metadata: {
          action: "manual_correction",
          versionBefore: existing.currentVersion,
          versionAfter: updated?.currentVersion,
          changes,
        },
      });
      return apiSuccess(updated);
    }

    const existing = await WorkDiariesRepository.getById(documentId);
    if (!existing) return apiError("יומן עבודה לא נמצא", 404);
    const rejectedByActor = existing.approvals.some(
      (approval: {
        status: string;
        approver?: { id?: string | null } | null;
      }) =>
        approval.status === "rejected" &&
        approval.approver?.id === session.userId
    );
    if (existing.status !== "revision" || !rejectedByActor) {
      return apiError("אין הרשאה לערוך תיקון זה", 403);
    }
    if (
      !(await userCanAccessProject({
        userId: session.userId,
        role: session.role,
        projectId: existing.projectId,
        scope: "operational",
      }))
    ) {
      return apiError("אין הרשאה לפרויקט זה", 403);
    }
    if (
      Number.isFinite(expectedVersion) &&
      expectedVersion !== existing.currentVersion
    ) {
      return apiError(
        "המסמך עודכן מאז שפתחת אותו. יש לרענן לפני שמירת השינויים.",
        409
      );
    }

    const before = {
      clientName: existing.clientName,
      address: existing.address,
      weather: existing.weather,
      workType: existing.workType,
      workSummary: existing.workSummary,
      notes: existing.notes,
      workItems: existing.workItems.map((item: {
        description: string;
        unit: string;
        quantity: number;
        notes?: string | null;
      }) => ({
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        notes: item.notes,
      })),
      workers: existing.workers.map((worker: {
        name: string;
        role?: string | null;
        startTime?: string | null;
        endTime?: string | null;
        hours?: number;
        notes?: string | null;
      }) => ({
        name: worker.name,
        role: worker.role,
        startTime: worker.startTime,
        endTime: worker.endTime,
        hours: worker.hours,
        notes: worker.notes,
      })),
    };
    const requested = {
      clientName:
        data.clientName == null ? null : String(data.clientName).trim(),
      address: data.address == null ? null : String(data.address),
      weather: data.weather == null ? null : String(data.weather),
      workType: data.workType == null ? null : String(data.workType),
      workSummary:
        data.workSummary == null ? null : String(data.workSummary),
      notes: data.notes == null ? null : String(data.notes),
      workItems: Array.isArray(data.workItems)
        ? data.workItems.map((item: Record<string, unknown>) => ({
            description: String(item.description || "").trim(),
            unit: String(item.unit || "יח'"),
            quantity: Number(item.quantity) || 0,
            notes: item.notes == null ? null : String(item.notes),
          }))
        : existing.workItems,
      workers: Array.isArray(data.workers)
        ? data.workers.map((worker: Record<string, unknown>) => ({
            name: String(worker.name || "").trim(),
            role: worker.role == null ? null : String(worker.role),
            startTime:
              worker.startTime == null ? null : String(worker.startTime),
            endTime: worker.endTime == null ? null : String(worker.endTime),
            hours: Number(worker.hours) || 0,
            notes: worker.notes == null ? null : String(worker.notes),
          }))
        : existing.workers,
    };

    const changes = changedValues(before, requested);
    const updated = await WorkDiariesRepository.update(documentId, {
      ...requested,
      updatedById: session.userId,
    });
    if (existing.workflowDocumentId) {
      await prisma.$transaction(async (tx) => {
        const workflow = await tx.workflowDocument.findUnique({
          where: { id: existing.workflowDocumentId! },
          select: { version: true },
        });
        if (!workflow) return;
        const nextVersion = workflow.version + 1;
        await tx.workflowDocument.update({
          where: { id: existing.workflowDocumentId! },
          data: { version: nextVersion, updatedById: session.userId },
        });
        await tx.workflowDocVersion.create({
          data: {
            documentId: existing.workflowDocumentId!,
            version: nextVersion,
            status: "revision",
            note: `תיקון ידני: ${changeSummary(changes)}`,
            actorId: session.userId,
            snapshotJson: JSON.stringify({ before, after: requested }),
          },
        });
        await tx.workflowEvent.create({
          data: {
            documentId: existing.workflowDocumentId!,
            type: "manual_correction",
            message: `בוצע תיקון ידני. שונו: ${changeSummary(changes)}`,
            actorId: session.userId,
            metadata: JSON.stringify({ changes }),
          },
        });
      });
    }
    await AuditRepository.log({
      action: "UPDATE",
      entityType: "WorkDiary",
      entityId: documentId,
      userId: session.userId,
      metadata: {
        action: "manual_correction",
        versionBefore: existing.currentVersion,
        versionAfter: updated?.currentVersion,
        changes,
      },
    });
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
