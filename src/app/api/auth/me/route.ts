import { requireOfficeUser, OfficeAuthError } from "@/lib/auth/office-session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await requireOfficeUser();
    return apiSuccess({
      id: session.userId,
      name: session.userName,
      email: session.email,
      username: session.username,
      role: session.role,
      roleLabel: session.roleLabel,
      avatarUrl: session.avatarUrl,
      employeeId: session.employeeId,
    });
  } catch (error) {
    if (error instanceof OfficeAuthError) {
      return apiError(error.message, error.status);
    }
    return handleApiError(error);
  }
}
