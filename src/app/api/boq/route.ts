import { NextRequest } from "next/server";
import { BOQRepository } from "@/repositories/boq.repository";
import { requireOfficeUser } from "@/lib/auth/office-session";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { parseListQuery } from "@/lib/api/list-query";
import type { BoqItemKind, BoqItemStatus } from "@prisma/client";
import { parseJsonBody } from "@/lib/validation/parse-body";
import { boqCreateSchema } from "@/lib/validation/schemas";
import { requireProjectPermission } from "@/lib/auth/assert-office";
import { listProjectsForRole } from "@/lib/auth/project-access";

export async function GET(request: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const sp = request.nextUrl.searchParams;
    const projectId = sp.get("projectId") ?? undefined;
    const itemKind = sp.get("itemKind");
    const status = sp.get("status");
    const parsed = parseListQuery(sp, { defaultTake: 50, maxTake: 200 });
    if (projectId) await requireProjectPermission("view_all", projectId);
    const assignedProjects = await listProjectsForRole({
      userId: session.userId,
      role: session.role,
      mode: "assigned",
    });
    const projectIds =
      session.role === "PROJECT_MANAGER"
        ? assignedProjects.map((project) => project.id)
        : undefined;

    const usePaged =
      parsed.paginated ||
      Boolean(parsed.q) ||
      Boolean(itemKind && itemKind !== "all") ||
      Boolean(status && status !== "all");

    if (usePaged) {
      const result = await BOQRepository.listPage({
        projectId,
        projectIds,
        q: parsed.q,
        itemKind: itemKind as BoqItemKind | "all" | null,
        status: status as BoqItemStatus | "all" | null,
        sort: parsed.sort,
        dir: parsed.dir,
        take: parsed.take,
        skip: parsed.skip,
      });
      return apiSuccess(result);
    }

    const data = projectId
      ? await BOQRepository.findByProject(projectId)
      : await BOQRepository.findAll(undefined, projectIds);
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireOfficeUser();
    const body = await parseJsonBody(request, boqCreateSchema);
    await requireProjectPermission("create", body.projectId);

    const item = await BOQRepository.create(
      {
        projectId: body.projectId,
        code: body.code,
        description: body.description,
        unit: body.unit,
        contractQuantity: body.contractQuantity,
        unitPrice: body.unitPrice,
        category: body.category,
        notes: body.notes,
        itemKind: (body.itemKind === "regular"
          ? "regular"
          : "exceptional") as BoqItemKind,
        status: (body.status || "active") as BoqItemStatus,
      },
      session.userId
    );

    return apiSuccess(item, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
