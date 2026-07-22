import { NextRequest } from "next/server";
import { BOQRepository } from "@/repositories/boq.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    await requireOfficeUser();
    const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;
    const data = projectId
      ? await BOQRepository.findByProject(projectId)
      : await BOQRepository.findAll();
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const body = await request.json();

    if (!body.projectId) return apiError("יש לבחור פרויקט");
    if (!body.description?.trim()) return apiError("יש להזין תיאור");

    const contractQuantity = Number(body.contractQuantity);
    const unitPrice = Number(body.unitPrice);
    if (Number.isNaN(contractQuantity) || contractQuantity < 0) {
      return apiError("כמות לא תקינה");
    }
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      return apiError("מחיר יחידה לא תקין");
    }

    const item = await BOQRepository.create(
      {
        projectId: String(body.projectId),
        code: body.code,
        description: String(body.description),
        unit: body.unit,
        contractQuantity,
        unitPrice,
        category: body.category,
        notes: body.notes,
        itemKind: body.itemKind === "regular" ? "regular" : "exceptional",
        status: body.status || "active",
      },
      session.userId
    );

    return apiSuccess(item, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
