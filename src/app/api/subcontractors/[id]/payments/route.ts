import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireSubcontractorOfficeAction } from "@/lib/auth/subcontractor-permissions";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorOfficeAction("record_payments");
    const { id } = await ctx.params;
    const body = await req.json();
    const data = await SubcontractorsRepository.recordPayment(
      {
        subcontractorId: id,
        accountId: body.accountId || null,
        amount: Number(body.amount),
        paidAt: String(body.paidAt || new Date().toISOString()),
        method: String(body.method || "transfer"),
        reference: body.reference || undefined,
        notes: body.notes || undefined,
      },
      session.userId
    );
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
