import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { hasDocumentPermission } from "@/lib/auth/document-permissions";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ kind: string; id: string }>;
};

export async function POST(_request: NextRequest, context: Context) {
  try {
    const user = await requireOfficeUser();
    if (!hasDocumentPermission(user.role, "send_to_client")) {
      return apiError("אין הרשאה לבטל קישור חתימה", 403);
    }
    const { kind, id } = await context.params;
    const revokedAt = new Date();

    const result =
      kind === "work_diary"
        ? await prisma.workDiarySignToken.updateMany({
            where: { id, revokedAt: null },
            data: { revokedAt },
          })
        : kind === "delivery_note"
          ? await prisma.opsDeliveryNoteSignToken.updateMany({
              where: { id, revokedAt: null },
              data: { revokedAt },
            })
          : kind === "measurement_sheet"
            ? await prisma.measurementSheetSignToken.updateMany({
                where: { id, revokedAt: null },
                data: { revokedAt },
              })
            : null;

    if (!result) return apiError("סוג קישור אינו נתמך", 400);
    if (!result.count) return apiError("הקישור לא נמצא או שכבר בוטל", 404);

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entityType: "SignatureLink",
        entityId: id,
        userId: user.userId,
        metadata: JSON.stringify({ action: "revoke", kind }),
      },
    });
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
