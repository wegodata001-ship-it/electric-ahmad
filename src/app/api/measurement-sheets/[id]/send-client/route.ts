import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { whatsappShareUrl } from "@/lib/documents/sign-tokens";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/** After Ops approval — create client signature link for the measurement sheet */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    if (!isSystemAdminRole(session.role)) {
      return apiError("רק מנהל מערכת יכול ליצור ולשלוח קישור חיצוני", 403);
    }

    const { id } = await ctx.params;
    const origin = req.nextUrl.origin;
    const { url, documentNumber } =
      await MeasurementSheetsRepository.createClientSignLink(
        id,
        session.userId,
        origin
      );

    const body = await req.json().catch(() => ({}));
    const phone = body.phone as string | undefined;
    const custom = typeof body.message === "string" ? body.message.trim() : "";
    const message = custom
      ? custom.includes(url)
        ? custom
        : `${custom}\n${url}`
      : `שלום,\n\nמצורף דוח ביצוע / דף מדידה מאושר לבדיקתך.\nלצפייה במסמך לחץ על הקישור:\n${url}\n\nתודה.`;

    return apiSuccess({
      url,
      documentNumber,
      whatsappUrl: whatsappShareUrl(phone, message),
      message,
    });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
