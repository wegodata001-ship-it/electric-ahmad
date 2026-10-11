import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  assertOfficeCanAccessSubcontractor,
  canViewBankDetails,
  requireSubcontractorOfficeAction,
} from "@/lib/auth/subcontractor-permissions";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeAuth();
    const { id } = await ctx.params;
    await assertOfficeCanAccessSubcontractor(session, id);
    const data = await SubcontractorsRepository.getById(
      id,
      canViewBankDetails(session.role)
    );
    const [ledger, measurements, accounts] = await Promise.all([
      SubcontractorsRepository.ledger(id),
      SubcontractorsRepository.listMeasurements({ subcontractorId: id }),
      SubcontractorsRepository.listAccounts({ subcontractorId: id }),
    ]);
    return apiSuccess({ ...data, ledger, measurements, accounts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSubcontractorOfficeAction("manage_registry");
    const { id } = await ctx.params;
    const body = await req.json();
    const data = await SubcontractorsRepository.update(
      id,
      body,
      session.userId,
      canViewBankDetails(session.role)
    );
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
