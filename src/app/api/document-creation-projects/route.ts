import { requireOfficeUser } from "@/lib/auth/office-session";
import { listWdDnCreationProjects } from "@/lib/auth/cross-project-documents";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Dedicated selector for WD/DN creation only. */
export async function GET() {
  try {
    const session = await requireOfficeUser();
    const projects = await listWdDnCreationProjects(session);
    return apiSuccess({ projects });
  } catch (error) {
    return handleApiError(error);
  }
}
