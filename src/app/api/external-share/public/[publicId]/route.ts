import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { hashSignToken, parseSignQuery } from "@/lib/documents/sign-tokens";

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
    if (row.revokedAt) return apiError("הקישור בוטל", 410);
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      return apiError("פג תוקף הקישור", 410);
    }

    if (parsed) {
      if (parsed.publicId !== publicId) return apiError("קישור לא תקין", 403);
      if (hashSignToken(parsed.raw) !== row.tokenHash) {
        return apiError("קישור לא תקין", 403);
      }
    }

    await prisma.externalShareLink.update({
      where: { id: row.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });

    let projectName: string | null = null;
    let document: {
      name: string;
      url: string | null;
      type?: string;
    } | null = null;

    if (row.entityType === "document") {
      const doc = await prisma.document.findUnique({
        where: { id: row.entityId },
        select: {
          name: true,
          url: true,
          type: true,
          project: { select: { name: true } },
        },
      });
      if (doc) {
        document = { name: doc.name, url: doc.url, type: doc.type };
        projectName = doc.project.name;
      }
    } else if (row.projectId) {
      const p = await prisma.project.findUnique({
        where: { id: row.projectId },
        select: { name: true },
      });
      projectName = p?.name ?? null;
    }

    return apiSuccess({
      title: row.title ?? document?.name ?? "מסמך משותף",
      notes: row.notes,
      projectName,
      entityType: row.entityType,
      document,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
