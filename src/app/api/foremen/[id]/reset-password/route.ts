import { NextRequest } from "next/server";
import { ForemenRepository } from "@/repositories/foremen.repository";
import { getAuthContext } from "@/lib/auth/session";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuthContext();
    const { id } = await params;
    const body = await request.json();
    const result = await ForemenRepository.resetPassword(
      id,
      body.password ?? body.newPassword ?? "",
      userId
    );
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error) return apiError(error.message, 400);
    return handleApiError(error);
  }
}
