import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireSubcontractorUser } from "@/lib/auth/subcontractor-session";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

export async function GET() {
  try {
    const session = await requireSubcontractorUser();
    const data = await SubcontractorsRepository.portalHome(session.subcontractorId, {
      membershipId: session.membershipId,
      portalRole: session.portalRole,
      canViewFinance: session.canViewFinance,
    });
    return apiSuccess({
      companyName: session.companyName,
      portalRole: session.portalRole,
      canViewFinance: session.canViewFinance,
      ...data,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
