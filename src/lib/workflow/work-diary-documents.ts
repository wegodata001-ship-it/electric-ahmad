import type { WorkflowStatus } from "@/lib/workflow/types";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow/types";
import { upsertOfficialArchiveDocument } from "@/lib/documents/official-document";

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
 * מעדכן folderPath לפי סטטוס המנוע + גרסת PDF ב־Audit.
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
  bumpVersion?: boolean;
}) {
  const folderPath = workDiaryArchiveFolder(input.status);
  const printPath = `/print/work-diaries/${input.workDiaryId}`;
  const absolutePrint = input.printBaseUrl
    ? `${input.printBaseUrl.replace(/\/$/, "")}${printPath}`
    : printPath;

  return upsertOfficialArchiveDocument({
    projectId: input.projectId,
    sourceType: "work_diary",
    sourceId: input.workDiaryId,
    documentNumber: input.documentNumber,
    title: input.title || `יומן עבודה ${input.documentNumber}`,
    folderPath,
    printPath: absolutePrint.startsWith("http") ? printPath : absolutePrint,
    userId: input.userId,
    workflowDocumentId: input.workflowDocumentId,
    statusLabel: WORKFLOW_STATUS_LABELS[input.status] ?? input.status,
    bumpVersion: input.bumpVersion ?? true,
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
