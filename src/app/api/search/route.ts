import { NextRequest } from "next/server";
import { DashboardRepository } from "@/repositories/dashboard.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q");
    if (!q || q.length < 2) return apiSuccess([]);
    return apiSuccess(await DashboardRepository.search(q));
  } catch (error) {
    return handleApiError(error);
  }
}
