import { prisma } from "@/lib/prisma";
import { AuditRepository } from "@/repositories/audit.repository";
import type { WorkflowStatus } from "@/lib/workflow/types";

export function opsDnArchiveFolder(status: string): string {
  switch (status) {
    case "revision":
      return "תעודות משלוח/דורש תיקון";
    case "draft":
      return "תעודות משלוח/טיוטות";
    case "approved":
    case "signed":
    case "sent_to_client":
    case "client_signed":
      return "תעודות משלוח/מאושרים";
    case "pending_approval":
    case "in_approval":
    default:
      return "תעודות משלוח/ממתין לאישור";
  }
}

/**
 * Sync / bump official PDF archive entry for a document.
 * Print-ready HTML is the source of truth; Document + versions track the official file.
 */
export async function upsertOfficialArchiveDocument(input: {
  projectId: string;
  sourceType: "work_diary" | "delivery_note";
  sourceId: string;
  documentNumber: string;
  title: string;
  folderPath: string;
  printPath: string;
  userId: string;
  workflowDocumentId?: string | null;
  statusLabel?: string;
  bumpVersion?: boolean;
}) {
  const name = `${input.title}.pdf`;
  const storagePath = input.printPath.replace(/^\//, "");
  const url = input.printPath;

  const existing = await prisma.document.findFirst({
    where: {
      OR: [
        ...(input.workflowDocumentId
          ? [{ workflowDocumentId: input.workflowDocumentId }]
          : []),
        { sourceType: input.sourceType, sourceId: input.sourceId },
      ],
    },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (existing) {
    const nextVersion = input.bumpVersion
      ? existing.version + 1
      : existing.version;

    const updated = await prisma.document.update({
      where: { id: existing.id },
      data: {
        name,
        folderPath: input.folderPath,
        url,
        path: storagePath,
        version: nextVersion,
        workflowDocumentId: input.workflowDocumentId ?? existing.workflowDocumentId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        ownerId: existing.ownerId || input.userId,
        uploadedById: existing.uploadedById || input.userId,
        updatedById: input.userId,
        ...(input.bumpVersion
          ? {
              versions: {
                create: {
                  version: nextVersion,
                  size: 0,
                  bucket: "documents",
                  path: storagePath,
                  url,
                  uploadedById: input.userId,
                },
              },
            }
          : {}),
      },
    });

    if (input.bumpVersion) {
      await AuditRepository.log({
        action: "UPDATE",
        entityType: "Document",
        entityId: updated.id,
        userId: input.userId,
        metadata: {
          action: "pdf_regenerated",
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          version: nextVersion,
          statusLabel: input.statusLabel,
          printPath: input.printPath,
        },
      });
    }

    return updated;
  }

  const created = await prisma.document.create({
    data: {
      projectId: input.projectId,
      name,
      type: "pdf",
      extension: "pdf",
      size: 0,
      bucket: "documents",
      path: storagePath,
      url,
      folderPath: input.folderPath,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      workflowDocumentId: input.workflowDocumentId ?? undefined,
      uploadedById: input.userId,
      ownerId: input.userId,
      createdById: input.userId,
      updatedById: input.userId,
      versions: {
        create: {
          version: 1,
          size: 0,
          bucket: "documents",
          path: storagePath,
          url,
          uploadedById: input.userId,
        },
      },
    },
  });

  await AuditRepository.log({
    action: "CREATE",
    entityType: "Document",
    entityId: created.id,
    userId: input.userId,
    metadata: {
      action: "pdf_created",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      printPath: input.printPath,
    },
  });

  return created;
}

export async function syncOpsDeliveryNoteArchiveDocument(input: {
  opsDeliveryNoteId: string;
  projectId: string;
  documentNumber: string;
  status: string;
  userId: string;
  bumpVersion?: boolean;
}) {
  return upsertOfficialArchiveDocument({
    projectId: input.projectId,
    sourceType: "delivery_note",
    sourceId: input.opsDeliveryNoteId,
    documentNumber: input.documentNumber,
    title: `תעודת משלוח ${input.documentNumber}`,
    folderPath: opsDnArchiveFolder(input.status),
    printPath: `/print/ops-delivery-notes/${input.opsDeliveryNoteId}`,
    userId: input.userId,
    statusLabel: input.status,
    bumpVersion: input.bumpVersion ?? true,
  });
}

export async function listMyOfficialDocuments(userId: string) {
  const rows = await prisma.document.findMany({
    where: {
      OR: [{ ownerId: userId }, { createdById: userId }, { uploadedById: userId }],
      sourceType: { in: ["work_diary", "delivery_note"] },
    },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  // Enrich with live entity status when possible
  const diaryIds = rows
    .filter((r) => r.sourceType === "work_diary" && r.sourceId)
    .map((r) => r.sourceId!);
  const dnIds = rows
    .filter((r) => r.sourceType === "delivery_note" && r.sourceId)
    .map((r) => r.sourceId!);

  const [diaries, notes] = await Promise.all([
    diaryIds.length
      ? prisma.workDiary.findMany({
          where: { id: { in: diaryIds } },
          select: {
            id: true,
            status: true,
            documentNumber: true,
            workflowDocument: { select: { status: true } },
          },
        })
      : Promise.resolve([]),
    dnIds.length
      ? prisma.opsDeliveryNote.findMany({
          where: { id: { in: dnIds } },
          select: { id: true, status: true, documentNumber: true },
        })
      : Promise.resolve([]),
  ]);

  const diaryMap = new Map(diaries.map((d) => [d.id, d]));
  const noteMap = new Map(notes.map((n) => [n.id, n]));

  return rows.map((r) => {
    let status = "draft";
    let statusLabel = "טיוטה";
    if (r.sourceType === "work_diary" && r.sourceId) {
      const d = diaryMap.get(r.sourceId);
      status = String(d?.workflowDocument?.status || d?.status || "draft");
    } else if (r.sourceType === "delivery_note" && r.sourceId) {
      const n = noteMap.get(r.sourceId);
      status = String(n?.status || "draft");
    }
    statusLabel = statusLabelHe(status);
    return {
      id: r.id,
      name: r.name,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      documentNumber:
        r.sourceType === "work_diary"
          ? diaryMap.get(r.sourceId || "")?.documentNumber
          : noteMap.get(r.sourceId || "")?.documentNumber,
      project: r.project,
      folderPath: r.folderPath,
      url: r.url,
      version: r.version,
      status,
      statusLabel,
      updatedAt: r.updatedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    };
  });
}

function statusLabelHe(status: string): string {
  switch (status) {
    case "draft":
      return "טיוטה";
    case "pending_approval":
    case "in_approval":
      return "ממתין לאישור";
    case "approved":
      return "מאושר";
    case "revision":
      return "נדחה / לתיקון";
    case "signed":
    case "client_signed":
    case "sent_to_client":
      return "נחתם";
    default:
      return status;
  }
}

export type { WorkflowStatus };
