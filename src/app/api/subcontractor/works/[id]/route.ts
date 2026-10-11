import { NextRequest } from "next/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireSubcontractorUser } from "@/lib/auth/subcontractor-session";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

type Ctx = { params: Promise<{ id: string }> };

function access(session: Awaited<ReturnType<typeof requireSubcontractorUser>>) {
  return {
    userId: session.userId,
    role: session.role,
    subcontractorId: session.subcontractorId,
    membershipId: session.membershipId,
    portalRole: session.portalRole,
  };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorUser();
    const { id } = await ctx.params;
    return apiSuccess(await SubcontractorsRepository.getAssignmentDetail(id, access(session)));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorUser();
    const { id } = await ctx.params;
    const body = await req.json();
    if (body.action === "start") {
      return apiSuccess(await SubcontractorsRepository.startWork(id, access(session)));
    }
    if (body.action === "submit") {
      return apiSuccess(
        await SubcontractorsRepository.submitWork(
          id,
          {
            workSummary: body.workSummary,
            notes: body.notes,
            hours: body.hours != null ? Number(body.hours) : undefined,
            workItems: body.workItems,
          },
          access(session)
        )
      );
    }
    if (body.action === "draft") {
      return apiSuccess(
        await SubcontractorsRepository.createWorkDiary(
          {
            assignmentId: id,
            workDate: new Date(),
            workSummary: body.workSummary,
            notes: body.notes,
            workItems: body.workItems,
            hours: body.hours != null ? Number(body.hours) : undefined,
          },
          access(session)
        )
      );
    }
    return apiError("פעולה לא חוקית");
  } catch (error) {
    return handleApiError(error);
  }
}
