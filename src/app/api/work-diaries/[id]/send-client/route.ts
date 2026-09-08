import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { WorkDiariesRepository } from "@/repositories/work-diaries.repository";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { whatsappShareUrl } from "@/lib/documents/sign-tokens";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    if (!isSystemAdminRole(session.role)) {
      return apiError("רק מנהל מערכת יכול ליצור ולשלוח קישור חיצוני", 403);
    }

    const { id } = await ctx.params;
    const origin = req.nextUrl.origin;
    const { url, documentNumber } = await WorkDiariesRepository.createClientSignLink(
      id,
      session.userId,
      origin
    );

    const body = await req.json().catch(() => ({}));
    const phone = body.phone as string | undefined;
    const message =
      body.message ??
      `שלום,\n\nמצורף יומן העבודה לבדיקתך.\nלצפייה ולחתימה לחץ על הקישור:\n${url}\n\nתודה.`;

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
