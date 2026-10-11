import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireSubcontractorOfficeAction } from "@/lib/auth/subcontractor-permissions";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorOfficeAction("record_payments");
    const { id } = await ctx.params;
    const body = await req.json();
    const data = await SubcontractorsRepository.voidPayment(
      id,
      String(body.reason || "תיקון מתועד"),
      session.userId
    );
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
