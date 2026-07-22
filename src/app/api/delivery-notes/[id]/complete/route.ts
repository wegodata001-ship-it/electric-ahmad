import { NextRequest } from "next/server";
import { DeliveryNotesRepository } from "@/repositories/delivery-notes.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, handleApiError } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/** סיום תעודת משלוח — נעילה + שמירה במסמכי הפרויקט */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await ctx.params;
    const result = await DeliveryNotesRepository.complete(
      id,
      userId,
      request.nextUrl.origin
    );
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
