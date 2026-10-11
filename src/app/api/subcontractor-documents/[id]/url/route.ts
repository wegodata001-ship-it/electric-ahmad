import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { assertOfficeCanAccessSubcontractor } from "@/lib/auth/subcontractor-permissions";
import { readSubcontractorSessionPayload } from "@/lib/auth/subcontractor-session";
import { requireSubcontractorUser } from "@/lib/auth/subcontractor-session";
import { createSignedStorageUrl } from "@/lib/supabase/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const doc = await prisma.subcontractorDocument.findUnique({ where: { id } });
    if (!doc) return apiError("מסמך לא נמצא", 404);

    const subPayload = await readSubcontractorSessionPayload();
    if (subPayload) {
      const session = await requireSubcontractorUser();
      if (doc.subcontractorId !== session.subcontractorId) {
        return apiError("אין הרשאה למסמך זה", 403);
      }
    } else {
      const session = await requireOfficeAuth();
      await assertOfficeCanAccessSubcontractor(session, doc.subcontractorId);
    }

    const url = await createSignedStorageUrl(doc.bucket, doc.path);
    return apiSuccess({ url, title: doc.title, mimeType: doc.mimeType });
  } catch (error) {
    return handleApiError(error);
  }
}
