import { prisma } from "@/lib/prisma";
import { mapProject } from "@/lib/mappers";
import { AuditRepository } from "./audit.repository";
import type { ProjectStatus } from "@prisma/client";

export class ProjectsRepository {
  static async findAll(status?: ProjectStatus) {
    const rows = await prisma.project.findMany({
      where: status ? { status } : undefined,
      include: {
        foreman: true,
        _count: { select: { employees: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapProject);
  }

  static async findById(id: string) {
    const row = await prisma.project.findUnique({
      where: { id },
      include: {
        foreman: true,
        _count: { select: { employees: true } },
      },
    });
    return row ? mapProject(row) : null;
  }

  static async findRecent(limit = 5) {
    const rows = await prisma.project.findMany({
      take: limit,
      include: {
        foreman: true,
        _count: { select: { employees: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(mapProject);
  }

  static async create(
    data: {
      name: string;
      contractNumber: string;
      contractor: string;
      location: string;
      foremanId: string;
      status?: ProjectStatus;
      contractValue: number;
      imageUrl?: string;
      startDate: Date;
      endDate: Date;
      description?: string;
    },
    userId: string
  ) {
    const row = await prisma.project.create({
      data: {
        ...data,
        contractValue: data.contractValue,
        ownerId: userId,
        createdById: userId,
        updatedById: userId,
      },
      include: {
        foreman: true,
        _count: { select: { employees: true } },
      },
    });

    await AuditRepository.log({
      action: "CREATE",
      entityType: "Project",
      entityId: row.id,
      userId,
    });

    return mapProject(row);
  }

  static async update(
    id: string,
    data: Partial<{
      name: string;
      contractor: string;
      location: string;
      foremanId: string;
      status: ProjectStatus;
      contractValue: number;
      completedValue: number;
      progress: number;
      imageUrl: string;
      imagePath: string;
      imageBucket: string;
      description: string;
      endDate: Date;
    }>,
    userId: string
  ) {
    const row = await prisma.project.update({
      where: { id },
      data: { ...data, updatedById: userId },
      include: {
        foreman: true,
        _count: { select: { employees: true } },
      },
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "Project",
      entityId: id,
      userId,
      metadata: data as Record<string, unknown>,
    });

    return mapProject(row);
  }

  static async delete(id: string, userId: string) {
    await prisma.project.delete({ where: { id } });
    await AuditRepository.log({
      action: "DELETE",
      entityType: "Project",
      entityId: id,
      userId,
    });
  }
}
