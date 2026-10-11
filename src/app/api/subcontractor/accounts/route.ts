import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  requireSubcontractorUser,
  requireSubcontractorFinance,
} from "@/lib/auth/subcontractor-session";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

export async function GET() {
  try {
    const session = await requireSubcontractorUser();
    requireSubcontractorFinance(session);
    const items = await SubcontractorsRepository.listAccounts({
      subcontractorId: session.subcontractorId,
    });
    return apiSuccess({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSubcontractorUser();
    requireSubcontractorFinance(session);
    const body = await req.json();
    const created = await SubcontractorsRepository.createAccount(
      {
        assignmentId: String(body.assignmentId),
        measurementIds: body.measurementIds,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        vatRate: body.vatRate != null ? Number(body.vatRate) : undefined,
        deductions: Number(body.deductions || 0),
        advances: Number(body.advances || 0),
        retention: Number(body.retention || 0),
        notes: body.notes,
        officialInvoiceRef: body.officialInvoiceRef,
      },
      { userId: session.userId, subcontractorId: session.subcontractorId }
    );
    const submitted = await SubcontractorsRepository.transitionAccount(
      created.id,
      "submit",
      session.userId
    );
    return apiSuccess(submitted);
  } catch (error) {
    return handleApiError(error);
  }
}
