import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { canApproveDocuments } from "@/lib/auth/document-permissions";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { whatsappShareUrl } from "@/lib/documents/sign-tokens";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    if (!canApproveDocuments(session.role)) {
      return apiError("אין הרשאה לשלוח ללקוח", 403);
    }

    const { id } = await ctx.params;
    const origin = req.nextUrl.origin;
    const { url, documentNumber } =
      await OpsDeliveryNotesRepository.createClientSignLink(id, session.userId, origin);

    const body = await req.json().catch(() => ({}));
    const phone = body.phone as string | undefined;
    const message =
      body.message ??
      `שלום,\n\nמצורפת תעודת המשלוח לבדיקתך.\nלצפייה ולחתימה לחץ על הקישור:\n${url}\n\nתודה.`;

    return apiSuccess({
      url,
      documentNumber,
      whatsappUrl: whatsappShareUrl(phone, message),
      message,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
