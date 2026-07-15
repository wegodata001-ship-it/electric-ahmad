import { NextRequest } from "next/server";
import { requireFieldManager } from "@/lib/auth/field-session";
import { WorkOrdersRepository } from "@/repositories/work-orders.repository";
import { uploadToStorage } from "@/lib/supabase/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  try {
    const session = await requireFieldManager();
    const { id } = await context.params;

    const order = await WorkOrdersRepository.findById(id, session.foremanId);
    if (!order) return apiError("סידור עבודה לא נמצא", 404);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return apiError("לא נבחר קובץ");
    }

    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      bucketKey: file.type.startsWith("image/") ? "images" : "documents",
      projectId: order.projectId,
      subfolder: `work-orders/${id}`,
    });

    const media = await WorkOrdersRepository.addMedia(id, session.foremanId, {
      kind: file.type.startsWith("image/") ? "photo" : "document",
      name: file.name,
      url: uploaded.url,
      path: uploaded.path,
      bucket: uploaded.bucket,
      size: uploaded.size,
    });

    return apiSuccess(media, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
