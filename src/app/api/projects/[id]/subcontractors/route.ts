import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import {
  assertOfficeCanAccessProject,
  requireSubcontractorOfficeAction,
} from "@/lib/auth/subcontractor-permissions";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeAuth();
    const { id } = await ctx.params;
    await assertOfficeCanAccessProject(session, id);
    const [items, summary] = await Promise.all([
      SubcontractorsRepository.listAssignments({ projectId: id }),
      SubcontractorsRepository.projectSummary(id),
    ]);
    return apiSuccess({ items, summary });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorOfficeAction("manage_assignments");
    const { id } = await ctx.params;
    await assertOfficeCanAccessProject(session, id);
    const body = await req.json();
    const data = await SubcontractorsRepository.createAssignment(
      {
        subcontractorId: String(body.subcontractorId),
        projectId: id,
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
