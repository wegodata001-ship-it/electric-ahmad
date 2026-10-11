import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import {
  assertOfficeCanAccessSubcontractor,
  requireSubcontractorOfficeAction,
} from "@/lib/auth/subcontractor-permissions";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";
import { money } from "@/lib/subcontractors/constants";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeAuth();
    const { id } = await ctx.params;
    await assertOfficeCanAccessSubcontractor(session, id);
    const assignmentId = req.nextUrl.searchParams.get("assignmentId");
    const items = await SubcontractorsRepository.listRates(id, assignmentId);
    return apiSuccess({
      items: items.map((r) => ({
        id: r.id,
        assignmentId: r.assignmentId,
        description: r.description,
        unit: r.unit,
        unitPrice: money(r.unitPrice),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorOfficeAction("manage_rates");
    const { id } = await ctx.params;
    await assertOfficeCanAccessSubcontractor(session, id);
    const body = await req.json();
    const items = await SubcontractorsRepository.upsertRates(
      id,
      body.assignmentId || null,
      Array.isArray(body.items) ? body.items : [body],
      session.userId
    );
    return apiSuccess({
      items: items.map((r) => ({
        id: r.id,
        description: r.description,
        unit: r.unit,
        unitPrice: money(r.unitPrice),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
