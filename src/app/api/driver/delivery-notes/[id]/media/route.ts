import { NextRequest } from "next/server";
import { requireTruckDriver } from "@/lib/auth/driver-session";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { uploadToStorage } from "@/lib/supabase/storage";
import { AuditRepository } from "@/repositories/audit.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireTruckDriver();
    const { id } = await ctx.params;
    const raw = await prisma.opsDeliveryNote.findFirst({
      where: { id, deletedAt: null },
      select: { createdById: true, status: true },
    });
    if (!raw) return apiError("תעודת משלוח לא נמצאה", 404);
    if (raw.createdById !== session.userId) {
      return apiError("אין גישה לתעודה זו", 403);
    }

    const body = await req.json().catch(() => ({}));
    const dataUrl = String(body.imageBase64 || body.dataUrl || "");
    if (!dataUrl.startsWith("data:image")) {
      return apiError("חסרה תמונה");
    }

    let url = dataUrl.slice(0, 1_500_000);
    let path: string | null = null;
    let bucket: string | null = null;
    let size = 0;

    try {
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const buf = Buffer.from(match[2], "base64");
        size = buf.length;
        if (buf.length > 0 && buf.length < 8 * 1024 * 1024) {
          const uploaded = await uploadToStorage({
            file: buf,
            fileName: `dn-${id.slice(0, 8)}.jpg`,
            mimeType: mime,
            size: buf.length,
            bucketKey: "images",
            projectId: "__driver_dn__",
            subfolder: session.userId,
          });
          url = uploaded.url;
          path = uploaded.path;
          bucket = uploaded.bucket;
        }
      }
    } catch {
      /* keep data URL */
    }

    const media = await OpsDeliveryNotesRepository.addMedia(id, {
      name: String(body.name || "תמונה"),
      url,
      path: path ?? undefined,
      bucket: bucket ?? undefined,
      size,
      stage: String(body.stage || "other"),
    });

    await AuditRepository.log({
      action: "UPLOAD",
      entityType: "OpsDeliveryNoteMedia",
      entityId: media.id,
      userId: session.userId,
      metadata: { opsDeliveryNoteId: id, stage: body.stage || "other" },
    });

    return apiSuccess(media, 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
