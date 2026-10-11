import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { requireOfficeAuth } from "@/lib/auth/assert-office";
import { assertOfficeCanAccessSubcontractor } from "@/lib/auth/subcontractor-permissions";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireOfficeAuth();
    const { id } = await ctx.params;
    await assertOfficeCanAccessSubcontractor(session, id);
    const data = await SubcontractorsRepository.ledger(id);
    const format = req.nextUrl.searchParams.get("format");
    if (format === "csv") {
      const rows = [
        ["תאריך", "סוג", "סכום", "אסמכתה", "פרויקט", "משתמש", "הערות"],
        ...data.entries.map((e) => [
          e.date.slice(0, 10),
          e.type,
          String(e.amount),
          e.reference ?? "",
          e.projectName ?? "",
          e.actorName ?? "",
          e.notes ?? "",
        ]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      return new Response(`\uFEFF${csv}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ledger-${id}.csv"`,
        },
      });
    }
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
