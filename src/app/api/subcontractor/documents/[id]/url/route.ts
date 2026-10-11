import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { requireSubcontractorUser } from "@/lib/auth/subcontractor-session";
import { createSignedStorageUrl } from "@/lib/supabase/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorUser();
    const { id } = await ctx.params;
    const doc = await prisma.subcontractorDocument.findUnique({ where: { id } });
    if (!doc || doc.subcontractorId !== session.subcontractorId) {
      return apiError("אין הרשאה למסמך זה", 403);
    }
    const url = await createSignedStorageUrl(doc.bucket, doc.path);
    return apiSuccess({ url, title: doc.title, mimeType: doc.mimeType });
  } catch (error) {
    return handleApiError(error);
  }
}
