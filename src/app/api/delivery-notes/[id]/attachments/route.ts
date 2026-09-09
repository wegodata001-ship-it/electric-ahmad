import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { assertCanAccessOwnedWdOrDn } from "@/lib/auth/cross-project-documents";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { uploadToStorage, resolveDocumentType } from "@/lib/supabase/storage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireOfficeUser();
    const { id } = await params;
    const note = await DeliveryNotesRepository.findById(id);
    if (!note) return apiError("תעודת משלוח לא נמצאה", 404);
    await assertCanAccessOwnedWdOrDn(session, note, "edit_draft");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return apiError("קובץ חובה");

    const mimeType = file.type || "application/octet-stream";
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const docType = resolveDocumentType(mimeType, extension);
    const kind =
      docType === "image" ? "image" : docType === "pdf" ? "pdf" : "document";

    const folderId = note.projectId || `delivery-notes/${note.id}`;
    const uploaded = await uploadToStorage({
      file,
      fileName: file.name,
      mimeType,
      size: file.size,
      bucketKey: docType === "image" ? "images" : "deliveryNotes",
      projectId: folderId,
      subfolder: "delivery-notes",
    });

    const attachment = await DeliveryNotesRepository.addAttachment(id, {
      name: file.name,
      mimeType,
      size: file.size,
      kind,
      bucket: uploaded.bucket,
      path: uploaded.path,
      url: uploaded.url,
    });

    return apiSuccess(attachment, 201);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
