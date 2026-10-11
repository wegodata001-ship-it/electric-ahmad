import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import {
  assertOfficeCanAccessProject,
  assertOfficeCanAccessSubcontractor,
  requireSubcontractorOfficeAction,
} from "@/lib/auth/subcontractor-permissions";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeAuth();
    const { id } = await ctx.params;
    await assertOfficeCanAccessSubcontractor(session, id);
    const items = await SubcontractorsRepository.listAssignments({
      subcontractorId: id,
    });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorOfficeAction("manage_assignments");
    const { id } = await ctx.params;
    const body = await req.json();
    await assertOfficeCanAccessProject(session, String(body.projectId));
    const data = await SubcontractorsRepository.createAssignment(
      {
        subcontractorId: id,
        projectId: String(body.projectId),
        workSiteId: body.workSiteId || null,
        managerId: body.managerId || null,
        description: String(body.description ?? ""),
        startDate: body.startDate || null,
        plannedEndDate: body.plannedEndDate || null,
        engagementType: body.engagementType || "mixed",
        amount: body.amount != null ? Number(body.amount) : null,
        notes: body.notes || null,
      },
      session.userId
    );
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
