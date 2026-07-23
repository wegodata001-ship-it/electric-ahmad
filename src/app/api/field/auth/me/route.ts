import { requireFieldManager, FieldAuthError } from "@/lib/auth/field-session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Minimal session probe for Field Portal shell (P1) */
export async function GET() {
  try {
    const session = await requireFieldManager();
    return apiSuccess({
      id: session.userId,
      name: session.userName,
      username: session.username,
      role: session.role,
      employeeId: session.foremanId,
    });
  } catch (error) {
    if (error instanceof FieldAuthError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
