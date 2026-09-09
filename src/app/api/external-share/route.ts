import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOfficeUser } from "@/lib/auth/office-session";
import {
  canSendFinancialToClient,
  SEND_TO_CLIENT_FORBIDDEN_MESSAGE,
} from "@/lib/auth/financial-permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { generateSignToken } from "@/lib/documents/sign-tokens";
import {
  decryptShareToken,
  encryptShareToken,
} from "@/lib/documents/share-token-vault";
import { AuditRepository } from "@/repositories/audit.repository";

function statusOf(row: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}) {
  if (row.revokedAt) return "revoked" as const;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return "expired" as const;
  return "active" as const;
}

function publicOrigin(request?: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const requestOrigin = request?.nextUrl.origin;
  return (configured || requestOrigin || "").replace(/\/$/, "");
}

async function assertShareTargetExists(entityType: string, entityId: string) {
  const exists =
    entityType === "document"
      ? await prisma.document.findUnique({
          where: { id: entityId },
          select: { id: true },
        })
      : entityType === "work_diary"
        ? await prisma.workDiary.findUnique({
            where: { id: entityId },
            select: { id: true },
          })
        : entityType === "delivery_note" ||
            entityType === "ops_delivery_note"
          ? await prisma.opsDeliveryNote.findUnique({
              where: { id: entityId },
              select: { id: true },
            })
          : entityType === "measurement_sheet"
            ? await prisma.measurementSheet.findUnique({
                where: { id: entityId },
                select: { id: true },
              })
            : null;
  if (!exists) {
    throw new Error("לא ניתן ליצור קישור: המסמך המבוקש לא נמצא");
  }
}

/** List external share links (system manager + office) */
export async function GET(request: NextRequest) {
  try {
    await requireOfficeUser();
    const items = await prisma.externalShareLink.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    const projectIds = [
      ...new Set(items.map((item) => item.projectId).filter(Boolean)),
    ] as string[];
    const projects = projectIds.length
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : [];
    const projectNames = new Map(
      projects.map((project) => [project.id, project.name])
    );
    const origin = publicOrigin(request);
    return apiSuccess({
      items: items.map((t) => {
        const raw = decryptShareToken(t.tokenCiphertext);
        const path = raw
          ? `/share/${t.publicId}?t=${encodeURIComponent(`${t.publicId}.${raw}`)}`
          : null;
        return {
          id: t.id,
          kind: "external" as const,
          entityType: t.entityType,
          documentId: t.entityId,
          documentNumber: t.title ?? t.entityId.slice(0, 8),
          title: t.title,
          projectId: t.projectId,
          projectName: t.projectId
            ? projectNames.get(t.projectId) ?? null
            : null,
          publicId: t.publicId,
          createdAt: t.createdAt.toISOString(),
          expiresAt: t.expiresAt?.toISOString() ?? null,
          usedAt: t.lastViewedAt?.toISOString() ?? null,
          revokedAt: t.revokedAt?.toISOString() ?? null,
          viewCount: t.viewCount,
          status: statusOf(t),
          url: path ? `${origin}${path}` : null,
          canCopy: Boolean(path),
          legacyToken: !t.tokenCiphertext,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Create secure share link — System Manager only */
export async function POST(request: NextRequest) {
  try {
    const user = await requireOfficeUser();
    if (!canSendFinancialToClient(user.role)) {
      return apiError(SEND_TO_CLIENT_FORBIDDEN_MESSAGE, 403);
    }

    const body = await request.json();
    const entityType = String(body.entityType ?? "document").trim();
    const entityId = String(body.entityId ?? "").trim();
    const projectId = body.projectId ? String(body.projectId) : null;
    const title = body.title ? String(body.title) : null;
    const notes = body.notes ? String(body.notes) : null;
    const days = Number(body.expiresInDays ?? 30);

    if (!entityId) return apiError("חסר מזהה ישות");

    const origin = publicOrigin(request);
    const existing = await prisma.externalShareLink.findFirst({
      where: {
        entityType,
        entityId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });
    const existingRaw = existing
      ? decryptShareToken(existing.tokenCiphertext)
      : null;
    if (existing && existingRaw) {
      const url = origin
        ? `${origin}/share/${existing.publicId}?t=${encodeURIComponent(`${existing.publicId}.${existingRaw}`)}`
        : `/share/${existing.publicId}?t=${encodeURIComponent(`${existing.publicId}.${existingRaw}`)}`;
      return apiSuccess({
        id: existing.id,
        publicId: existing.publicId,
        url,
        expiresAt: existing.expiresAt?.toISOString() ?? null,
        reused: true,
      });
    }

    await assertShareTargetExists(entityType, entityId);
    const { raw, hash, publicId } = generateSignToken();
    const expiresAt =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        : null;

    const row = await prisma.externalShareLink.create({
      data: {
        entityType,
        entityId,
        projectId,
        title,
        notes,
        tokenHash: hash,
        tokenCiphertext: encryptShareToken(raw),
        publicId,
        expiresAt,
        createdById: user.userId,
      },
    });

    await AuditRepository.log({
      action: "CREATE",
      entityType: "ExternalShareLink",
      entityId: row.id,
      userId: user.userId,
      metadata: {
        action: "create_external_share",
        targetType: entityType,
        targetId: entityId,
        publicId,
      },
    });

    const url = origin
      ? `${origin}/share/${publicId}?t=${encodeURIComponent(`${publicId}.${raw}`)}`
      : `/share/${publicId}?t=${publicId}.${raw}`;

    return apiSuccess({
      id: row.id,
      publicId,
      url,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      rawTokenHint: "הקישור המלא כולל את הטוקן — שמרו אותו; לא יוצג שוב במלואו",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
