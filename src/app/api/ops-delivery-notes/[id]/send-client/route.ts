import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { hasDocumentPermission } from "@/lib/auth/document-permissions";
import { OpsDeliveryNotesRepository } from "@/repositories/ops-delivery-notes.repository";
import { AuditRepository } from "@/repositories/audit.repository";
import {
  buildSignShareMessage,
  emailShareLink,
  smsShareLink,
  whatsappShareLink,
} from "@/lib/signatures";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/** System Manager only — send approved DN to client for digital signature */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    if (!hasDocumentPermission(session.role, "send_to_client")) {
      return apiError("רק מנהל מערכת יכול לשלוח ללקוח לחתימה", 403);
    }

    const { id } = await ctx.params;
    const origin = req.nextUrl.origin;
    const { url, documentNumber } =
      await OpsDeliveryNotesRepository.createClientSignLink(
        id,
        session.userId,
        origin
      );

    const body = await req.json().catch(() => ({}));
    const phone = body.phone ? String(body.phone) : undefined;
    const email = body.email ? String(body.email) : undefined;
    const message =
      body.message ??
      buildSignShareMessage({
        kindLabel: "תעודת משלוח",
        documentNumber,
        url,
      });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "OpsDeliveryNote",
      entityId: id,
      userId: session.userId,
      metadata: {
        action: "sent_to_client",
        documentNumber,
        url,
      },
    });

    return apiSuccess({
      url,
      documentNumber,
      message,
      whatsappUrl: whatsappShareLink(phone, message),
      smsUrl: smsShareLink(phone, message),
      emailUrl: emailShareLink({
        email,
        subject: `תעודת משלוח ${documentNumber} — לחתימה`,
        body: message,
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
