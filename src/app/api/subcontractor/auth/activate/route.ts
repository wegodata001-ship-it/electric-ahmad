import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { SubcontractorsRepository } from "@/repositories/subcontractors.repository";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await SubcontractorsRepository.activateInvite(
      String(body.token ?? ""),
      String(body.password ?? "")
    );
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
