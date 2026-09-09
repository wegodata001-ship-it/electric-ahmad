import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { hashSignToken, parseSignQuery } from "@/lib/documents/sign-tokens";
import type { ClientPortalPayload } from "@/lib/share/client-portal-payload";

/** Public view — no login. Validates token + records view. */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await ctx.params;
    const t = request.nextUrl.searchParams.get("t");
    const parsed = parseSignQuery(t);

    const row = await prisma.externalShareLink.findUnique({
      where: { publicId },
    });
    if (!row) return apiError("הקישור לא נמצא", 404);
    if (!parsed) return apiError("קישור לא תקין", 403);
    if (parsed.publicId !== publicId) return apiError("קישור לא תקין", 403);
    if (hashSignToken(parsed.raw) !== row.tokenHash) {
      return apiError("קישור לא תקין", 403);
    }
    if (row.revokedAt) return apiError("הקישור בוטל", 410);
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      return apiError("תוקף הקישור הסתיים", 410);
    }

    let projectName: string | null = null;
    let document: {
      name: string;
      url: string | null;
      type?: string;
    } | null = null;
    let portal: ClientPortalPayload | null = null;

    if (row.entityType === "document") {
      const doc = await prisma.document.findUnique({
        where: { id: row.entityId },
        select: {
          name: true,
          url: true,
          type: true,
          sourceType: true,
          sourceId: true,
          bucket: true,
          path: true,
          project: { select: { name: true } },
        },
      });
      if (doc) {
        let resolvedDocumentUrl = doc.url;
        if (
          doc.bucket &&
          doc.path &&
          /supabase\.co\/storage\//i.test(doc.url)
        ) {
          const { createSignedStorageUrl } = await import(
            "@/lib/supabase/storage"
          );
          const remainingSeconds = row.expiresAt
            ? Math.max(
                60,
                Math.floor((row.expiresAt.getTime() - Date.now()) / 1000)
              )
            : 24 * 60 * 60;
          resolvedDocumentUrl = await createSignedStorageUrl(
            doc.bucket,
            doc.path,
            Math.min(remainingSeconds, 24 * 60 * 60)
          );
        }
        const unsafeLocalUrl = /^https?:\/\/localhost(?::\d+)?\//i.test(
          resolvedDocumentUrl
        );
        document = {
          name: doc.name,
          url: unsafeLocalUrl
            ? `${new URL(resolvedDocumentUrl).pathname}${new URL(resolvedDocumentUrl).search}`
            : resolvedDocumentUrl,
          type: doc.type,
        };
        projectName = doc.project.name;

        const sourceType = doc.sourceType ?? "";
        if (doc.sourceId && sourceType.includes("work_diary")) {
          const [{ WorkDiariesRepository }, { buildDiaryPortal }] =
            await Promise.all([
              import("@/repositories/work-diaries.repository"),
              import("@/lib/share/client-portal-payload"),
            ]);
          const entity = await WorkDiariesRepository.getById(doc.sourceId);
          if (entity) {
            portal = await buildDiaryPortal(entity, {
              createdAt: row.createdAt,
              expiresAt: row.expiresAt,
              alreadySigned: Boolean(entity.clientSignedAt),
            });
          }
        } else if (doc.sourceId && sourceType.includes("delivery_note")) {
          const [{ OpsDeliveryNotesRepository }, { buildDeliveryPortal }] =
            await Promise.all([
              import("@/repositories/ops-delivery-notes.repository"),
              import("@/lib/share/client-portal-payload"),
            ]);
          const entity = await OpsDeliveryNotesRepository.getById(doc.sourceId);
          if (entity) {
            portal = await buildDeliveryPortal(entity, {
              createdAt: row.createdAt,
              expiresAt: row.expiresAt,
              alreadySigned: Boolean(entity.clientSignedAt),
            });
          }
        } else if (
          doc.sourceId &&
          sourceType.includes("measurement_sheet")
        ) {
          const [{ MeasurementSheetsRepository }, { buildMeasurementPortal }] =
            await Promise.all([
              import("@/repositories/measurement-sheets.repository"),
              import("@/lib/share/client-portal-payload"),
            ]);
          const entity = await MeasurementSheetsRepository.getById(
            doc.sourceId
          );
          if (entity) {
            portal = await buildMeasurementPortal(entity, {
              createdAt: row.createdAt,
              expiresAt: row.expiresAt,
              alreadySigned: Boolean(entity.clientSignedAt),
            });
          }
        }
      }
    } else if (row.entityType === "work_diary") {
      const diary = await prisma.workDiary.findUnique({
        where: { id: row.entityId },
        select: {
          id: true,
          documentNumber: true,
          project: { select: { name: true } },
        },
      });
      if (diary) {
        document = {
          name: diary.documentNumber,
          url: `/print/work-diaries/${diary.id}`,
          type: "work_diary",
        };
        projectName = diary.project.name;
      }
    } else if (
      row.entityType === "delivery_note" ||
      row.entityType === "ops_delivery_note"
    ) {
      const note = await prisma.opsDeliveryNote.findUnique({
        where: { id: row.entityId },
        select: {
          id: true,
          documentNumber: true,
          project: { select: { name: true } },
        },
      });
      if (note) {
        document = {
          name: note.documentNumber,
          url: `/print/ops-delivery-notes/${note.id}`,
          type: "delivery_note",
        };
        projectName = note.project?.name ?? null;
      }
    } else if (row.entityType === "measurement_sheet") {
      const sheet = await prisma.measurementSheet.findUnique({
        where: { id: row.entityId },
        select: {
          id: true,
          title: true,
          project: { select: { name: true } },
        },
      });
      if (sheet) {
        document = {
          name: sheet.title,
          url: `/print/measurement-sheets/${sheet.id}`,
          type: "measurement_sheet",
        };
        projectName = sheet.project.name;
      }
    } else if (row.projectId) {
      const p = await prisma.project.findUnique({
        where: { id: row.projectId },
        select: { name: true },
      });
      projectName = p?.name ?? null;
    }

    if (!document) return apiError("המסמך לא נמצא", 404);

    if (portal) {
      portal = {
        ...portal,
        relatedDocuments: [],
        measurementSheets: [],
      };
    }

    await prisma.externalShareLink.update({
      where: { id: row.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });

    return apiSuccess({
      title: row.title ?? document?.name ?? "מסמך משותף",
      notes: row.notes,
      projectName,
      entityType: row.entityType,
      document,
      portal,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
