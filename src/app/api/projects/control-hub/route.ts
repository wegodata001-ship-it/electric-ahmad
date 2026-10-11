import { NextRequest } from "next/server";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { ProjectControlHubRepository } from "@/repositories/project-control-hub.repository";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const sp = request.nextUrl.searchParams;
    const tree = await ProjectControlHubRepository.tree({
      userId: session.userId,
      role: session.role,
      filters: {
        q: sp.get("q") || undefined,
        clientId: sp.get("clientId") || undefined,
        projectId: sp.get("projectId") || undefined,
        siteId: sp.get("siteId") || undefined,
        status: sp.get("status") || undefined,
        regionId: sp.get("regionId") || undefined,
      },
    });
    return apiSuccess(tree);
  } catch (error) {
    return handleApiError(error);
  }
}
