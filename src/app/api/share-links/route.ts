import { requireOfficeUser } from "@/lib/auth/office-session";
import { prisma } from "@/lib/prisma";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { decryptShareToken } from "@/lib/documents/share-token-vault";

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
            select: {
              id: true,
              documentNumber: true,
              projectId: true,
              signedPdfUrl: true,
              clientSignedName: true,
              clientSignedAt: true,
              project: { select: { name: true } },
            },
          },
        },
      }),
      prisma.opsDeliveryNoteSignToken.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          opsDeliveryNote: {
            select: {
              id: true,
              documentNumber: true,
              projectId: true,
              signedPdfUrl: true,
              clientSignedName: true,
              clientSignedAt: true,
              project: { select: { name: true } },
            },
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
              clientSignedName: true,
              clientSignedAt: true,
              project: { select: { name: true } },
            },
          },
        },
      }),
    ]);
    const signedMeasurementDocuments = sheetTokens.length
      ? await prisma.document.findMany({
          where: {
            sourceType: "measurement_sheet_signed",
            sourceId: { in: sheetTokens.map((token) => token.sheetId) },
          },
          orderBy: { createdAt: "desc" },
          select: { sourceId: true, url: true },
        })
      : [];
    const signedMeasurementUrls = new Map<string, string>();
    for (const document of signedMeasurementDocuments) {
      if (
        document.sourceId &&
        document.url &&
        !signedMeasurementUrls.has(document.sourceId)
      ) {
        signedMeasurementUrls.set(document.sourceId, document.url);
      }
    }

    const items = [
      ...diaryTokens.map((t) => {
        const raw = decryptShareToken(t.tokenCiphertext);
        const tokenParam = raw ? `${t.publicId}.${raw}` : null;
        const signUrl = tokenParam
          ? `/sign/work-diary/${encodeURIComponent(t.workDiary.documentNumber)}?t=${encodeURIComponent(tokenParam)}`
          : null;
        return {
        id: t.id,
        kind: "work_diary" as const,
        documentId: t.workDiaryId,
        documentNumber: t.workDiary.documentNumber,
        projectId: t.workDiary.projectId,
        projectName: t.workDiary.project.name,
        publicId: t.publicId,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt?.toISOString() ?? null,
        usedAt: t.usedAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
        status: tokenStatus(t),
        documentUrl: `/print/work-diaries/${t.workDiaryId}`,
        pdfUrl: `/print/work-diaries/${t.workDiaryId}`,
        downloadUrl: `/print/work-diaries/${t.workDiaryId}?autoprint=1`,
        signatureDetailsUrl: t.workDiary.signedPdfUrl,
        signUrl,
        canCopy: Boolean(signUrl),
        signerName: t.workDiary.clientSignedName,
        signedAt: t.workDiary.clientSignedAt?.toISOString() ?? null,
      };
      }),
      ...noteTokens.map((t) => {
        const raw = decryptShareToken(t.tokenCiphertext);
        const tokenParam = raw ? `${t.publicId}.${raw}` : null;
        const signUrl = tokenParam
          ? `/sign/delivery-note/${encodeURIComponent(t.opsDeliveryNote.documentNumber)}?t=${encodeURIComponent(tokenParam)}`
          : null;
        return {
        id: t.id,
        kind: "delivery_note" as const,
        documentId: t.opsDeliveryNoteId,
        documentNumber: t.opsDeliveryNote.documentNumber,
        projectId: t.opsDeliveryNote.projectId,
        projectName: t.opsDeliveryNote.project?.name ?? null,
        publicId: t.publicId,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt?.toISOString() ?? null,
        usedAt: t.usedAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
        status: tokenStatus(t),
        documentUrl: `/print/ops-delivery-notes/${t.opsDeliveryNoteId}`,
        pdfUrl: `/print/ops-delivery-notes/${t.opsDeliveryNoteId}`,
        downloadUrl: `/print/ops-delivery-notes/${t.opsDeliveryNoteId}?autoprint=1`,
        signatureDetailsUrl: t.opsDeliveryNote.signedPdfUrl,
        signUrl,
        canCopy: Boolean(signUrl),
        signerName: t.opsDeliveryNote.clientSignedName,
        signedAt: t.opsDeliveryNote.clientSignedAt?.toISOString() ?? null,
      };
      }),
      ...sheetTokens.map((t) => {
        const raw = decryptShareToken(t.tokenCiphertext);
        const tokenParam = raw ? `${t.publicId}.${raw}` : null;
        const signedUrl = signedMeasurementUrls.get(t.sheetId) ?? null;
        const signUrl = tokenParam
          ? `/sign/measurement-sheet/${t.sheetId}?t=${encodeURIComponent(tokenParam)}`
          : null;
        return {
        id: t.id,
        kind: "measurement_sheet" as const,
        documentId: t.sheetId,
        documentNumber: t.sheet.title || `MS-${t.sheet.sequenceNumber}`,
        projectId: t.sheet.projectId,
        projectName: t.sheet.project.name,
        publicId: t.publicId,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt?.toISOString() ?? null,
        usedAt: t.usedAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
        status: tokenStatus(t),
        documentUrl: `/print/measurement-sheets/${t.sheetId}`,
        pdfUrl: `/print/measurement-sheets/${t.sheetId}`,
        downloadUrl: `/print/measurement-sheets/${t.sheetId}?autoprint=1`,
        signatureDetailsUrl: signedUrl,
        signUrl,
        canCopy: Boolean(signUrl),
        signerName: t.sheet.clientSignedName,
        signedAt: t.sheet.clientSignedAt?.toISOString() ?? null,
      };
      }),
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
