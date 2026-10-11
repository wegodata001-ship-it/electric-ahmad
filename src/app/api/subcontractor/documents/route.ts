import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireSubcontractorUser } from "@/lib/auth/subcontractor-session";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

export async function GET() {
  try {
    const session = await requireSubcontractorUser();
    const documents = await SubcontractorsRepository.listDocuments(session.subcontractorId);
    return apiSuccess({
      items: documents.map(({ id, category, categoryLabel, title, mimeType, sizeBytes, createdAt }) => ({
        id,
        category,
        categoryLabel,
        title,
        mimeType,
        sizeBytes,
        createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
