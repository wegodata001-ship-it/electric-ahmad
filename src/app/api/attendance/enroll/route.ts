import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { AttendanceCheckinRepository } from "@/repositories/attendance-checkin.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Complete one-time device enrollment wizard */
export async function POST(req: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const body = await req.json().catch(() => ({}));

    const deviceId = String(body.deviceId ?? "").trim();
    const selfieBase64 = String(body.selfieBase64 ?? "");
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const termsAccepted = Boolean(body.termsAccepted);

    if (!deviceId) return apiError("לא ניתן לזהות את המכשיר");
    if (!selfieBase64) return apiError("יש לצלם תמונת סלפי");
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return apiError("יש לאשר GPS");
    }

    const row = await AttendanceCheckinRepository.enrollDevice({
      userId: session.userId,
      deviceId,
      selfieBase64,
      latitude,
      longitude,
      termsAccepted,
      userAgent: body.userAgent
        ? String(body.userAgent).slice(0, 500)
        : req.headers.get("user-agent"),
      deviceType: body.deviceType ? String(body.deviceType) : null,
      osName: body.osName ? String(body.osName) : null,
    });

    return apiSuccess({
      enrolled: true,
      deviceId: row.deviceId,
      enrolledAt: row.enrolledAt?.toISOString() ?? null,
      message:
        "ההרשמה הושלמה בהצלחה. מהיום מספיק לסרוק את ה־QR לצורך כניסה ויציאה.",
    });
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
