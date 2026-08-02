import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { generateSignToken } from "@/lib/documents/sign-tokens";
import { AuditRepository } from "@/repositories/audit.repository";

function statusOf(row: {
  revokedAt: Date | null;
  expiresAt: Date | null;
}) {
  if (row.revokedAt) return "revoked" as const;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return "expired" as const;
  return "active" as const;
}

/** List external share links (system manager + office) */
export async function GET() {
  try {
    await requireOfficeUser();
    const items = await prisma.externalShareLink.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    return apiSuccess({
      items: items.map((t) => ({
        id: t.id,
        kind: "external" as const,
        entityType: t.entityType,
        documentId: t.entityId,
        documentNumber: t.title ?? t.entityId.slice(0, 8),
        projectId: t.projectId,
        publicId: t.publicId,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt?.toISOString() ?? null,
        usedAt: t.lastViewedAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
        viewCount: t.viewCount,
        status: statusOf(t),
        url: `/share/${t.publicId}`,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Create secure share link — System Manager only */
export async function POST(request: NextRequest) {
  try {
    const user = await requireOfficeUser();
    if (!isSystemAdminRole(user.role)) {
      return apiError("רק מנהל מערכת יכול ליצור קישור חיצוני", 403);
    }

    const body = await request.json();
    const entityType = String(body.entityType ?? "document").trim();
    const entityId = String(body.entityId ?? "").trim();
    const projectId = body.projectId ? String(body.projectId) : null;
    const title = body.title ? String(body.title) : null;
    const notes = body.notes ? String(body.notes) : null;
    const days = Number(body.expiresInDays ?? 30);

    if (!entityId) return apiError("חסר מזהה ישות");

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

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "";
    const url = origin
      ? `${origin.replace(/\/$/, "")}/share/${publicId}?t=${publicId}.${raw}`
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
