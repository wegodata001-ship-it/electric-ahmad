import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { MeasurementSheetsRepository } from "@/repositories/measurement-sheets.repository";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeUser();
    const { id } = await ctx.params;
    const body = await req.json();

    // Batch save: { cells: [{ rowId, boqItemId, quantity }, ...] }
    if (Array.isArray(body.cells)) {
      const result = await MeasurementSheetsRepository.setCellsBatch(
        id,
        body.cells.map((c: { rowId: string; boqItemId: string; quantity: number }) => ({
          rowId: String(c.rowId),
          boqItemId: String(c.boqItemId),
          quantity: Number(c.quantity),
        })),
        session.userId
      );
      return apiSuccess(result);
    }

    if (!body.rowId || !body.boqItemId) return apiError("חסרים פרטי תא");
    const cell = await MeasurementSheetsRepository.setCellQuantity(
      id,
      {
        rowId: String(body.rowId),
        boqItemId: String(body.boqItemId),
        quantity: Number(body.quantity),
        note: body.note,
      },
      session.userId
    );
    return apiSuccess(cell);
  } catch (error) {
    return handleApiError(error);
  }
}
