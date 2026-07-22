import { prisma } from "@/lib/prisma";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow/types";

/** תיקיות ארכיון יומן — מסמך אחד, רק folderPath משתנה */
export function workDiaryArchiveFolder(status: WorkflowStatus): string {
  switch (status) {
    case "pending_approval":
      return "יומני עבודה/ממתין לאישור";
    case "revision":
      return "יומני עבודה/דורש תיקון";
    case "approved":
      return "יומני עבודה/מאושרים";
    case "sent_to_client":
      return "יומני עבודה/נשלח ללקוח";
    case "client_signed":
    case "used_for_measurement":
    case "used_for_account":
    case "used_for_invoice":
    case "locked":
      return "יומני עבודה/חתומים ע״י לקוח";
    case "cancelled":
      return "יומני עבודה/ארכיון";
    case "draft":
    default:
      return "יומני עבודה/טיוטות";
  }
}

/**
 * מסמך אחד ב־Documents Hub לכל יומן.
 * מעדכן folderPath לפי סטטוס המנוע — בלי עותקים.
 */
export async function syncWorkDiaryArchiveDocument(input: {
  workflowDocumentId: string;
  workDiaryId: string;
  projectId: string;
  documentNumber: string;
  title?: string | null;
  status: WorkflowStatus;
  userId: string;
  printBaseUrl?: string;
}) {
  const folderPath = workDiaryArchiveFolder(input.status);
  const name = `${input.title || `יומן עבודה ${input.documentNumber}`}.pdf`;
  const path = `print/work-diaries/${input.workDiaryId}`;
  const printPath = `/print/work-diaries/${input.workDiaryId}`;
  const url = input.printBaseUrl
    ? `${input.printBaseUrl.replace(/\/$/, "")}${printPath}`
    : printPath;

  const existing = await prisma.document.findFirst({
    where: {
      OR: [
        { workflowDocumentId: input.workflowDocumentId },
        { sourceType: "work_diary", sourceId: input.workDiaryId },
      ],
    },
  });

  if (existing) {
    return prisma.document.update({
      where: { id: existing.id },
      data: {
        name,
        folderPath,
        url,
        workflowDocumentId: input.workflowDocumentId,
        sourceType: "work_diary",
        sourceId: input.workDiaryId,
        updatedById: input.userId,
      },
    });
  }

  return prisma.document.create({
    data: {
      projectId: input.projectId,
      name,
      type: "pdf",
      extension: "pdf",
      size: 0,
      bucket: "documents",
      path,
      url,
      folderPath,
      sourceType: "work_diary",
      sourceId: input.workDiaryId,
      workflowDocumentId: input.workflowDocumentId,
      uploadedById: input.userId,
      ownerId: input.userId,
      createdById: input.userId,
      updatedById: input.userId,
      versions: {
        create: {
          version: 1,
          size: 0,
          bucket: "documents",
          path,
          url,
          uploadedById: input.userId,
        },
      },
    },
  });
}

export function mapLegacyDiaryStatusToWorkflow(
  status: string
): WorkflowStatus {
  switch (status) {
    case "revision":
      return "revision";
    case "pending_approval":
    case "in_approval":
      return "pending_approval";
    case "approved":
      return "approved";
    case "sent_to_client":
      return "sent_to_client";
    case "signed":
    case "completed":
      return "client_signed";
    case "draft":
    default:
      return "draft";
  }
}

export { WORKFLOW_STATUS_LABELS };
