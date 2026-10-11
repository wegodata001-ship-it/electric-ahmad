import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireSubcontractorUser } from "@/lib/auth/subcontractor-session";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

export async function GET() {
  try {
    const session = await requireSubcontractorUser();
    const [assignments, diaries, rates] = await Promise.all([
      SubcontractorsRepository.listAssignments({
        subcontractorId: session.subcontractorId,
        membershipId: session.membershipId,
        portalRole: session.portalRole,
      }),
      SubcontractorsRepository.listWorkDiaries({
        subcontractorId: session.subcontractorId,
      }),
      SubcontractorsRepository.listRates(session.subcontractorId),
    ]);
    return apiSuccess({
      assignments,
      diaries,
      rates: rates.map((r) => ({
        id: r.id,
        assignmentId: r.assignmentId,
        description: r.description,
        unit: r.unit,
        unitPrice: Number(r.unitPrice),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSubcontractorUser();
    const body = await req.json();
    const data = await SubcontractorsRepository.createWorkDiary(
      {
        assignmentId: String(body.assignmentId),
        workDate: new Date(body.workDate || Date.now()),
        workSummary: body.workSummary,
        notes: body.notes,
        workItems: body.workItems,
        hours: body.hours != null ? Number(body.hours) : undefined,
      },
      {
        userId: session.userId,
        role: session.role,
        subcontractorId: session.subcontractorId,
      }
    );
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
