import { NextRequest } from "next/server";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { assertCanAccessOwnedWdOrDn } from "@/lib/auth/cross-project-documents";
import { apiSuccess, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/** שמירת PDF במסמכי הפרויקט (תיקיית תעודות משלוח) */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const note = await DeliveryNotesRepository.findById(id);
    if (!note) throw new Error("תעודת משלוח לא נמצאה");
    await assertCanAccessOwnedWdOrDn(session, note, "view_all");
    const result = await DeliveryNotesRepository.saveDocument(
      id,
      session.userId,
      request.nextUrl.origin
    );
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
