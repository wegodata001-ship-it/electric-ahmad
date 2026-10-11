import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const UNASSIGNED_REGION_ID = "__unassigned__";
export const UNASSIGNED_REGION_NAME = "ללא אזור משויך";

export type WorkRegionRow = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

export const WorkRegionsRepository = {
  async list(includeInactive = false): Promise<WorkRegionRow[]> {
    if (includeInactive) {
      return prisma.$queryRaw<WorkRegionRow[]>`
        SELECT id, name, "sortOrder", active
        FROM "WorkRegion"
        ORDER BY "sortOrder" ASC, name ASC
      `;
    }
    return prisma.$queryRaw<WorkRegionRow[]>`
      SELECT id, name, "sortOrder", active
      FROM "WorkRegion"
      WHERE active = true
      ORDER BY "sortOrder" ASC, name ASC
    `;
  },

  async create(input: { name: string; sortOrder?: number }): Promise<WorkRegionRow> {
    const name = input.name.trim();
    if (!name) throw new Error("שם אזור חובה");
    const max = await prisma.$queryRaw<Array<{ max: number | null }>>`
      SELECT MAX("sortOrder") AS max FROM "WorkRegion"
    `;
    const sortOrder = input.sortOrder ?? (max[0]?.max ?? 0) + 1;
    const id = `region_${Date.now().toString(36)}`;
    await prisma.$executeRaw`
      INSERT INTO "WorkRegion" (id, name, "sortOrder", active, "updatedAt")
      VALUES (${id}, ${name}, ${sortOrder}, true, CURRENT_TIMESTAMP)
    `;
    const rows = await prisma.$queryRaw<WorkRegionRow[]>`
      SELECT id, name, "sortOrder", active FROM "WorkRegion" WHERE id = ${id}
    `;
    return rows[0];
  },

  async update(
    id: string,
    input: { name?: string; sortOrder?: number; active?: boolean }
  ): Promise<WorkRegionRow> {
    const current = await prisma.$queryRaw<WorkRegionRow[]>`
      SELECT id, name, "sortOrder", active FROM "WorkRegion" WHERE id = ${id}
    `;
    if (!current[0]) throw new Error("אזור לא נמצא");
    const name = input.name?.trim() || current[0].name;
    const sortOrder = input.sortOrder ?? current[0].sortOrder;
    const active = input.active ?? current[0].active;
    await prisma.$executeRaw`
      UPDATE "WorkRegion"
      SET name = ${name}, "sortOrder" = ${sortOrder}, active = ${active}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    const rows = await prisma.$queryRaw<WorkRegionRow[]>`
      SELECT id, name, "sortOrder", active FROM "WorkRegion" WHERE id = ${id}
    `;
    return rows[0];
  },

  async deactivate(id: string) {
    return this.update(id, { active: false });
  },

  async projectRegionMap(projectIds: string[]) {
    if (!projectIds.length) return new Map<string, string | null>();
    const rows = await prisma.$queryRaw<Array<{ id: string; workRegionId: string | null }>>`
      SELECT id, "workRegionId" FROM "Project" WHERE id IN (${Prisma.join(projectIds)})
    `;
    return new Map(rows.map((row) => [row.id, row.workRegionId]));
  },

  async siteRegionMap(siteIds: string[]) {
    if (!siteIds.length) return new Map<string, string | null>();
    const rows = await prisma.$queryRaw<Array<{ id: string; workRegionId: string | null }>>`
      SELECT id, "workRegionId" FROM "ProjectWorkSite" WHERE id IN (${Prisma.join(siteIds)})
    `;
    return new Map(rows.map((row) => [row.id, row.workRegionId]));
  },

  async assignSiteRegion(siteId: string, workRegionId: string | null) {
    if (workRegionId) {
      const exists = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "WorkRegion" WHERE id = ${workRegionId} AND active = true
      `;
      if (!exists[0]) throw new Error("אזור עבודה לא נמצא");
    }
    await prisma.$executeRaw`
      UPDATE "ProjectWorkSite"
      SET "workRegionId" = ${workRegionId}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${siteId}
    `;
  },
};
