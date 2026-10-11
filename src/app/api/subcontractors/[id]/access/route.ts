import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireSubcontractorOfficeAction } from "@/lib/auth/subcontractor-permissions";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorOfficeAction("manage_users");
    const { id } = await ctx.params;
    const body = await req.json();
    if (body.action === "disable" || body.action === "enable") {
      const data = await SubcontractorsRepository.setUserAccess(
        id,
        String(body.membershipId),
        body.action === "disable" ? "disabled" : "active",
        session.userId
      );
      return apiSuccess(data);
    }
    const data = await SubcontractorsRepository.openAccess(
      id,
      {
        email: String(body.email ?? ""),
        contactName: String(body.contactName ?? ""),
        portalRole: body.portalRole,
      },
      session.userId
    );
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
