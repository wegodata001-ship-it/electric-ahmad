import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { requireSubcontractorOfficeAction } from "@/lib/auth/subcontractor-permissions";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireOfficeAuth();
    const { id } = await ctx.params;
    return apiSuccess(await SubcontractorsRepository.getMeasurement(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorOfficeAction("review_measurements");
    const { id } = await ctx.params;
    const body = await req.json();
    if (body.action === "submit") {
      return apiSuccess(
        await SubcontractorsRepository.submitMeasurement(id, session.userId)
      );
    }
    return apiSuccess(
      await SubcontractorsRepository.reviewMeasurement(
        id,
        {
          action: body.action,
          items: body.items,
          reviewNotes: body.reviewNotes,
        },
        session.userId
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}
