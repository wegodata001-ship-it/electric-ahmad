import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOfficeUser } from "@/lib/auth/office-session";
import {
  canSendFinancialToClient,
  SEND_TO_CLIENT_FORBIDDEN_MESSAGE,
} from "@/lib/auth/financial-permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { AuditRepository } from "@/repositories/audit.repository";

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireOfficeUser();
    if (!canSendFinancialToClient(user.role)) {
      return apiError(SEND_TO_CLIENT_FORBIDDEN_MESSAGE, 403);
    }
    const { id } = await ctx.params;
    const row = await prisma.externalShareLink.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await AuditRepository.log({
      action: "UPDATE",
      entityType: "ExternalShareLink",
      entityId: id,
      userId: user.userId,
      metadata: { action: "revoke_external_share", publicId: row.publicId },
    });
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
