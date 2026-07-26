import { NextRequest } from "next/server";
import { DashboardRepository } from "@/repositories/dashboard.repository";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    await getCurrentUser();
    const type = request.nextUrl.searchParams.get("type");

    if (type === "chart") return apiSuccess(await DashboardRepository.getChartData());
    if (type === "progress") return apiSuccess(await DashboardRepository.getProgressData());

    return apiSuccess(await DashboardRepository.getKPIs());
  } catch (error) {
    return handleApiError(error);
  }
}
