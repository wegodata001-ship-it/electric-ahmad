import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { requireSubcontractorOfficeAction } from "@/lib/auth/subcontractor-permissions";
import { canApproveSubcontractorFinance } from "@/lib/auth/subcontractor-permissions";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeAuth();
    const { id } = await ctx.params;
    return apiSuccess(await SubcontractorsRepository.getAccount(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeAuth();
    const { id } = await ctx.params;
    const body = await req.json();
    const action = String(body.action || "");
    if (action === "approve" || action === "ready") {
      await requireSubcontractorOfficeAction("approve_accounts");
    } else {
      await requireSubcontractorOfficeAction("review_measurements");
    }
    if ((action === "approve" || action === "ready") && !canApproveSubcontractorFinance(session.role)) {
      throw new Error("אין הרשאה לאישור חשבון");
    }
    return apiSuccess(
      await SubcontractorsRepository.transitionAccount(
        id,
        action as "submit" | "pm_review" | "approve" | "return" | "ready",
        session.userId,
        body.notes
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}
