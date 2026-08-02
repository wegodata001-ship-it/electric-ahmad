import { requireOfficeUser } from "@/lib/auth/office-session";
import { prisma } from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/response";

type ShareLinkStatus = "active" | "used" | "revoked" | "expired";

function tokenStatus(row: {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
}): ShareLinkStatus {
  if (row.revokedAt) return "revoked";
  if (row.usedAt) return "used";
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return "expired";
  return "active";
}

export async function GET() {
  try {
    await requireOfficeUser();
    const limit = 50;

    const [diaryTokens, noteTokens, sheetTokens] = await Promise.all([
      prisma.workDiarySignToken.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          workDiary: {
            select: { id: true, documentNumber: true, projectId: true },
          },
        },
      }),
      prisma.opsDeliveryNoteSignToken.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          opsDeliveryNote: {
            select: { id: true, documentNumber: true, projectId: true },
          },
        },
      }),
      prisma.measurementSheetSignToken.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          sheet: {
            select: {
              id: true,
              title: true,
              sequenceNumber: true,
              projectId: true,
            },
          },
        },
      }),
    ]);

    const items = [
      ...diaryTokens.map((t) => ({
        id: t.id,
        kind: "work_diary" as const,
        documentId: t.workDiaryId,
        documentNumber: t.workDiary.documentNumber,
        projectId: t.workDiary.projectId,
        publicId: t.publicId,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt?.toISOString() ?? null,
        usedAt: t.usedAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
        status: tokenStatus(t),
      })),
      ...noteTokens.map((t) => ({
        id: t.id,
        kind: "delivery_note" as const,
        documentId: t.opsDeliveryNoteId,
        documentNumber: t.opsDeliveryNote.documentNumber,
        projectId: t.opsDeliveryNote.projectId,
        publicId: t.publicId,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt?.toISOString() ?? null,
        usedAt: t.usedAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
        status: tokenStatus(t),
      })),
      ...sheetTokens.map((t) => ({
        id: t.id,
        kind: "measurement_sheet" as const,
        documentId: t.sheetId,
        documentNumber: t.sheet.title || `MS-${t.sheet.sequenceNumber}`,
        projectId: t.sheet.projectId,
        publicId: t.publicId,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt?.toISOString() ?? null,
        usedAt: t.usedAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
        status: tokenStatus(t),
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);

    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
