import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireSubcontractorUser } from "@/lib/auth/subcontractor-session";

export async function GET() {
  try {
    const session = await requireSubcontractorUser();
    return apiSuccess({
      id: session.userId,
      name: session.userName,
      email: session.email,
      username: session.username,
      role: session.role,
      portalRole: session.portalRole,
      canViewFinance: session.canViewFinance,
      subcontractorId: session.subcontractorId,
      companyName: session.companyName,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
