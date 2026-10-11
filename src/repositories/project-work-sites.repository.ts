import { prisma } from "@/lib/prisma";

export type WorkSiteInput = {
  name: string;
  address?: string | null;
  contactName?: string | null;
  status?: string;
};

function mapSite(row: {
  id: string;
  projectId: string;
  name: string;
  address: string | null;
  contactName: string | null;
  status: string;
  _count?: { workDiaries: number; opsDeliveryNotes: number };
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    address: row.address,
    contactName: row.contactName,
    status: row.status,
    diaryCount: row._count?.workDiaries ?? 0,
    deliveryNoteCount: row._count?.opsDeliveryNotes ?? 0,
  };
}

export const ProjectWorkSitesRepository = {
  async listForProject(projectId: string) {
    const rows = await prisma.projectWorkSite.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            workDiaries: { where: { deletedAt: null } },
            opsDeliveryNotes: { where: { deletedAt: null } },
          },
        },
      },
    });
    return rows.map(mapSite);
  },

  async getById(id: string) {
    const row = await prisma.projectWorkSite.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            workDiaries: { where: { deletedAt: null } },
            opsDeliveryNotes: { where: { deletedAt: null } },
          },
        },
      },
    });
    return row ? mapSite(row) : null;
  },

  async create(projectId: string, input: WorkSiteInput) {
    const name = input.name.trim();
    if (!name) throw new Error("שם סניף חובה");
    const row = await prisma.projectWorkSite.create({
      data: {
        projectId,
        name,
        address: input.address?.trim() || null,
        contactName: input.contactName?.trim() || null,
        status: input.status?.trim() || "active",
      },
      include: {
        _count: {
          select: { workDiaries: true, opsDeliveryNotes: true },
        },
      },
    });
    return mapSite(row);
  },

  async update(id: string, input: Partial<WorkSiteInput>) {
    const row = await prisma.projectWorkSite.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.address !== undefined
          ? { address: input.address?.trim() || null }
          : {}),
        ...(input.contactName !== undefined
          ? { contactName: input.contactName?.trim() || null }
          : {}),
        ...(input.status != null ? { status: input.status.trim() } : {}),
      },
      include: {
        _count: {
          select: { workDiaries: true, opsDeliveryNotes: true },
        },
      },
    });
    return mapSite(row);
  },
};
