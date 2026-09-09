import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { hasDocumentPermission } from "@/lib/auth/document-permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  buildSignUrl,
  generateSignToken,
} from "@/lib/documents/sign-tokens";
import { encryptShareToken } from "@/lib/documents/share-token-vault";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ kind: string; id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireOfficeUser();
    if (!hasDocumentPermission(user.role, "send_to_client")) {
      return apiError("אין הרשאה ליצור קישור חתימה", 403);
    }
    const { kind, id } = await context.params;
    const { raw, hash, publicId } = generateSignToken();
    const tokenCiphertext = encryptShareToken(raw);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    let documentNumber = "";
    let newTokenId = "";

    if (kind === "work_diary") {
      const old = await prisma.workDiarySignToken.findUnique({
        where: { id },
        include: {
          workDiary: {
            select: {
              id: true,
              documentNumber: true,
              clientSignedAt: true,
            },
          },
        },
      });
      if (!old) return apiError("הקישור לא נמצא", 404);
      if (old.workDiary.clientSignedAt) return apiError("המסמך כבר נחתם", 410);
      documentNumber = old.workDiary.documentNumber;
      newTokenId = await prisma.$transaction(async (tx) => {
        await tx.workDiarySignToken.updateMany({
          where: {
            workDiaryId: old.workDiaryId,
            usedAt: null,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        const created = await tx.workDiarySignToken.create({
          data: {
            workDiaryId: old.workDiaryId,
            tokenHash: hash,
            tokenCiphertext,
            publicId,
            expiresAt,
            createdById: user.userId,
          },
        });
        return created.id;
      });
    } else if (kind === "delivery_note") {
      const old = await prisma.opsDeliveryNoteSignToken.findUnique({
        where: { id },
        include: {
          opsDeliveryNote: {
            select: {
              id: true,
              documentNumber: true,
              clientSignedAt: true,
            },
          },
        },
      });
      if (!old) return apiError("הקישור לא נמצא", 404);
      if (old.opsDeliveryNote.clientSignedAt) {
        return apiError("המסמך כבר נחתם", 410);
      }
      documentNumber = old.opsDeliveryNote.documentNumber;
      newTokenId = await prisma.$transaction(async (tx) => {
        await tx.opsDeliveryNoteSignToken.updateMany({
          where: {
            opsDeliveryNoteId: old.opsDeliveryNoteId,
            usedAt: null,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        const created = await tx.opsDeliveryNoteSignToken.create({
          data: {
            opsDeliveryNoteId: old.opsDeliveryNoteId,
            tokenHash: hash,
            tokenCiphertext,
            publicId,
            expiresAt,
            createdById: user.userId,
          },
        });
        return created.id;
      });
    } else if (kind === "measurement_sheet") {
      const old = await prisma.measurementSheetSignToken.findUnique({
        where: { id },
        include: {
          sheet: {
            select: { id: true, clientSignedAt: true },
          },
        },
      });
      if (!old) return apiError("הקישור לא נמצא", 404);
      if (old.sheet.clientSignedAt) return apiError("המסמך כבר נחתם", 410);
      documentNumber = old.sheetId;
      newTokenId = await prisma.$transaction(async (tx) => {
        await tx.measurementSheetSignToken.updateMany({
          where: { sheetId: old.sheetId, usedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        const created = await tx.measurementSheetSignToken.create({
          data: {
            sheetId: old.sheetId,
            tokenHash: hash,
            tokenCiphertext,
            publicId,
            expiresAt,
            createdById: user.userId,
          },
        });
        return created.id;
      });
    } else {
      return apiError("סוג קישור אינו נתמך", 400);
    }

    const url = buildSignUrl({
      baseUrl: request.nextUrl.origin,
      kind:
        kind === "work_diary"
          ? "work-diary"
          : kind === "delivery_note"
            ? "delivery-note"
            : "measurement-sheet",
      documentNumber,
      publicId,
      rawToken: raw,
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "SignatureLink",
        entityId: newTokenId,
        userId: user.userId,
        metadata: JSON.stringify({
          action: "renew",
          kind,
          replacesTokenId: id,
          publicId,
        }),
      },
    });
    return apiSuccess({
      id: newTokenId,
      publicId,
      url,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
