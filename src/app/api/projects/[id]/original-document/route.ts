import { NextRequest } from "next/server";
import { ProjectOriginalDocumentRepository } from "@/repositories/project-original-document.repository";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await paramsId(ctx);
    const session = await requireProjectPermission("view_all", id);
    const result = await ProjectOriginalDocumentRepository.get(id);
    return apiSuccess({
      ...result,
      canReplace: isSystemAdminRole(session.role),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await paramsId(ctx);
    const session = await requireProjectPermission("create", id);
    if (!isSystemAdminRole(session.role)) {
      return apiError("רק מנהל מערכת יכול להעלות או להחליף את קובץ המקור", 403);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return apiError("יש להעלות קובץ PDF");
    }
    const mimeType = file.type || "application/pdf";
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (mimeType !== "application/pdf" && extension !== "pdf") {
      return apiError("ניתן להעלות קובץ PDF בלבד");
    }

    const result = await ProjectOriginalDocumentRepository.upload(
      id,
      file,
      session.userId
    );
    return apiSuccess({
      ...result,
      canReplace: true,
    });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}

async function paramsId(ctx: Ctx) {
  return ctx.params;
}
