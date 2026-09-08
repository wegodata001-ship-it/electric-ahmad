import { prisma } from "@/lib/prisma";
import type { WorkOrderStatus } from "@prisma/client";

export type WorkOrderWorkerInput = {
  crewMemberId?: string | null;
  name: string;
  role?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  hours?: number;
  notes?: string | null;
};

export type WorkOrderVehicleInput = {
  name: string;
  plate?: string | null;
  driverName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  hours?: number;
  notes?: string | null;
};

export type CreateWorkOrderInput = {
  projectId: string;
  foremanId: string;
  date: Date;
  title?: string | null;
  workArea?: string | null;
  clientName?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: WorkOrderStatus;
  workers?: WorkOrderWorkerInput[];
  vehicles?: WorkOrderVehicleInput[];
  createdById: string;
};

export type UpdateWorkOrderInput = {
  projectId?: string;
  date?: Date;
  title?: string | null;
  workArea?: string | null;
  clientName?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: WorkOrderStatus;
  workers?: WorkOrderWorkerInput[];
  vehicles?: WorkOrderVehicleInput[];
  updatedById: string;
};

const includeDetail = {
  project: {
    select: {
      id: true,
      name: true,
      location: true,
      contractor: true,
      contractNumber: true,
    },
  },
  foreman: {
    select: { id: true, firstName: true, lastName: true },
  },
  workers: { orderBy: { sortOrder: "asc" as const } },
  vehicles: { orderBy: { sortOrder: "asc" as const } },
  media: { orderBy: { createdAt: "desc" as const } },
};

function hoursBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

function mapOrder(row: any) {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    sequenceNumber: row.sequenceNumber,
    projectId: row.projectId,
    foremanId: row.foremanId,
    date: row.date.toISOString().slice(0, 10),
    title: row.title,
    workArea: row.workArea,
    clientName: row.clientName,
    address: row.address,
    notes: row.notes,
    status: row.status as WorkOrderStatus,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    project: row.project
      ? {
          id: row.project.id,
          name: row.project.name,
          location: row.project.location,
          contractor: row.project.contractor,
          contractNumber: row.project.contractNumber,
        }
      : null,
    foreman: row.foreman
      ? {
          id: row.foreman.id,
          name: `${row.foreman.firstName} ${row.foreman.lastName}`.trim(),
        }
      : null,
    workers: (row.workers ?? []).map((w: any) => ({
      id: w.id,
      crewMemberId: w.crewMemberId,
      name: w.name,
      role: w.role,
      startTime: w.startTime,
      endTime: w.endTime,
      hours: w.hours,
      notes: w.notes,
      sortOrder: w.sortOrder,
    })),
    vehicles: (row.vehicles ?? []).map((v: any) => ({
      id: v.id,
      name: v.name,
      plate: v.plate,
      driverName: v.driverName,
      startTime: v.startTime,
      endTime: v.endTime,
      hours: v.hours,
      notes: v.notes,
      sortOrder: v.sortOrder,
    })),
    media: (row.media ?? []).map((m: any) => ({
      id: m.id,
      kind: m.kind,
      name: m.name,
      url: m.url,
      path: m.path,
      size: m.size,
      createdAt: m.createdAt.toISOString(),
    })),
    workerCount: row.workers?.length ?? row._count?.workers ?? 0,
    vehicleCount: row.vehicles?.length ?? row._count?.vehicles ?? 0,
  };
}

export class WorkOrdersRepository {
  static async generateOrderNumber(): Promise<{
    orderNumber: string;
    sequenceNumber: number;
  }> {
    const year = new Date().getFullYear();
    const prefix = `WO-${year}-`;
    const last = await prisma.workOrder.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    const sequenceNumber = (last?.sequenceNumber ?? 0) + 1;
    const orderNumber = `${prefix}${String(sequenceNumber).padStart(4, "0")}`;
    return { orderNumber, sequenceNumber };
  }

  static async listForForeman(
    foremanId: string,
    opts?: { status?: WorkOrderStatus; take?: number }
  ) {
    const take = Math.min(opts?.take ?? 50, 50);
    const rows = await prisma.workOrder.findMany({
      where: {
        foremanId,
        ...(opts?.status ? { status: opts.status } : {}),
      },
      include: {
        project: {
          select: { id: true, name: true, location: true, contractor: true, contractNumber: true },
        },
        _count: { select: { workers: true, vehicles: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take,
    });
    return rows.map((r) =>
      mapOrder({ ...r, workers: [], vehicles: [], media: [] })
    );
  }

  static async getDashboardCounts(foremanId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayCount, draft, inProgress, completed] = await Promise.all([
      prisma.workOrder.count({
        where: {
          foremanId,
          date: { gte: today, lt: tomorrow },
          status: { not: "cancelled" },
        },
      }),
      prisma.workOrder.count({ where: { foremanId, status: "draft" } }),
      prisma.workOrder.count({ where: { foremanId, status: "in_progress" } }),
      prisma.workOrder.count({ where: { foremanId, status: "completed" } }),
    ]);

    return { todayCount, draft, inProgress, completed };
  }

  /** Operations queue — all work orders (office) */
  static async listAll(opts?: {
    status?: WorkOrderStatus;
    take?: number;
    skip?: number;
    date?: Date;
    projectId?: string;
    foremanId?: string;
  }) {
    const take = Math.min(opts?.take ?? 80, 200);
    const skip = Math.max(0, opts?.skip ?? 0);
    const dayStart = opts?.date ? new Date(opts.date) : undefined;
    if (dayStart) dayStart.setHours(0, 0, 0, 0);
    const dayEnd = dayStart
      ? new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      : undefined;

    const rows = await prisma.workOrder.findMany({
      where: {
        ...(opts?.status ? { status: opts.status } : {}),
        ...(opts?.projectId ? { projectId: opts.projectId } : {}),
        ...(opts?.foremanId ? { foremanId: opts.foremanId } : {}),
        ...(dayStart && dayEnd
          ? { date: { gte: dayStart, lt: dayEnd } }
          : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            location: true,
            contractor: true,
            contractNumber: true,
          },
        },
        foreman: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: { select: { workers: true, vehicles: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take,
      skip,
    });
    return rows.map((r) =>
      mapOrder({ ...r, workers: [], vehicles: [], media: [] })
    );
  }

  /** Counts by status for project / portal dashboards */
  static async getStatusCounts(opts?: { projectId?: string; foremanId?: string }) {
    const where = {
      ...(opts?.projectId ? { projectId: opts.projectId } : {}),
      ...(opts?.foremanId ? { foremanId: opts.foremanId } : {}),
    };
    const [draft, assigned, inProgress, completed, cancelled] =
      await Promise.all([
        prisma.workOrder.count({ where: { ...where, status: "draft" } }),
        prisma.workOrder.count({ where: { ...where, status: "assigned" } }),
        prisma.workOrder.count({ where: { ...where, status: "in_progress" } }),
        prisma.workOrder.count({ where: { ...where, status: "completed" } }),
        prisma.workOrder.count({ where: { ...where, status: "cancelled" } }),
      ]);
    return {
      draft,
      planned: assigned,
      inProgress,
      done: completed,
      closed: cancelled,
      open: draft + assigned,
    };
  }

  static async getOpsQueueCounts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      workOrdersToday,
      diariesPending,
      deliveryPending,
      diariesRevision,
      workOrdersDone,
    ] = await Promise.all([
      prisma.workOrder.count({
        where: {
          date: { gte: today, lt: tomorrow },
          status: { not: "cancelled" },
        },
      }),
      prisma.workflowApproval.count({
        where: {
          status: "pending",
          document: { kind: "WORK_DIARY", status: "pending_approval" },
        },
      }),
      prisma.workflowApproval.count({
        where: {
          status: "pending",
          document: { kind: "DELIVERY_NOTE", status: "pending_approval" },
        },
      }),
      prisma.workDiary.count({
        where: { deletedAt: null, status: "revision" },
      }),
      prisma.workOrder.count({
        where: {
          date: { gte: today, lt: tomorrow },
          status: "completed",
        },
      }),
    ]);

    return {
      workOrdersToday,
      diariesPending,
      deliveryPending,
      diariesRevision,
      workOrdersDone,
    };
  }

  static async findById(id: string, foremanId?: string) {
    const row = await prisma.workOrder.findFirst({
      where: { id, ...(foremanId ? { foremanId } : {}) },
      include: includeDetail,
    });
    return row ? mapOrder(row) : null;
  }

  static async create(input: CreateWorkOrderInput) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      select: { id: true, name: true, location: true, contractor: true },
    });
    if (!project) throw new Error("פרויקט לא נמצא");

    const { orderNumber, sequenceNumber } = await this.generateOrderNumber();
    const workers = (input.workers ?? []).filter((w) => w.name?.trim());
    const vehicles = (input.vehicles ?? []).filter((v) => v.name?.trim());

    const status =
      input.status ??
      (workers.length > 0 ? "assigned" : "draft");

    const row = await prisma.workOrder.create({
      data: {
        orderNumber,
        sequenceNumber,
        projectId: input.projectId,
        foremanId: input.foremanId,
        date: input.date,
        title: input.title?.trim() || null,
        workArea: input.workArea?.trim() || null,
        clientName: input.clientName?.trim() || project.contractor || null,
        address: input.address?.trim() || project.location || null,
        notes: input.notes?.trim() || null,
        status,
        createdById: input.createdById,
        updatedById: input.createdById,
        workers: {
          create: workers.map((w, i) => ({
            crewMemberId: w.crewMemberId || null,
            name: w.name.trim(),
            role: w.role?.trim() || null,
            startTime: w.startTime || null,
            endTime: w.endTime || null,
            hours: w.hours ?? hoursBetween(w.startTime, w.endTime),
            notes: w.notes?.trim() || null,
            sortOrder: i,
          })),
        },
        vehicles: {
          create: vehicles.map((v, i) => ({
            name: v.name.trim(),
            plate: v.plate?.trim() || null,
            driverName: v.driverName?.trim() || null,
            startTime: v.startTime || null,
            endTime: v.endTime || null,
            hours: v.hours ?? hoursBetween(v.startTime, v.endTime),
            notes: v.notes?.trim() || null,
            sortOrder: i,
          })),
        },
      },
      include: includeDetail,
    });

    return mapOrder(row);
  }

  static async update(id: string, foremanId: string, input: UpdateWorkOrderInput) {
    const existing = await prisma.workOrder.findFirst({
      where: { id, foremanId },
    });
    if (!existing) throw new Error("סידור עבודה לא נמצא");
    if (existing.status === "cancelled") {
      throw new Error("לא ניתן לערוך סידור שבוטל");
    }

    const workers = input.workers?.filter((w) => w.name?.trim());
    const vehicles = input.vehicles?.filter((v) => v.name?.trim());

    const row = await prisma.$transaction(
      async (tx) => {
        if (workers) {
          await tx.workOrderWorker.deleteMany({ where: { workOrderId: id } });
          if (workers.length > 0) {
            await tx.workOrderWorker.createMany({
              data: workers.map((w, i) => ({
                workOrderId: id,
                crewMemberId: w.crewMemberId || null,
                name: w.name.trim(),
                role: w.role?.trim() || null,
                startTime: w.startTime || null,
                endTime: w.endTime || null,
                hours: w.hours ?? hoursBetween(w.startTime, w.endTime),
                notes: w.notes?.trim() || null,
                sortOrder: i,
              })),
            });
          }
        }

        if (vehicles) {
          await tx.workOrderVehicle.deleteMany({ where: { workOrderId: id } });
          if (vehicles.length > 0) {
            await tx.workOrderVehicle.createMany({
              data: vehicles.map((v, i) => ({
                workOrderId: id,
                name: v.name.trim(),
                plate: v.plate?.trim() || null,
                driverName: v.driverName?.trim() || null,
                startTime: v.startTime || null,
                endTime: v.endTime || null,
                hours: v.hours ?? hoursBetween(v.startTime, v.endTime),
                notes: v.notes?.trim() || null,
                sortOrder: i,
              })),
            });
          }
        }

        let status = input.status ?? existing.status;
        if (
          !input.status &&
          workers &&
          workers.length > 0 &&
          existing.status === "draft"
        ) {
          status = "assigned";
        }

        const startedAt =
          status === "in_progress" && !existing.startedAt
            ? new Date()
            : existing.startedAt;
        const completedAt =
          status === "completed" && !existing.completedAt
            ? new Date()
            : status === "completed"
              ? existing.completedAt ?? new Date()
              : existing.completedAt;

        return tx.workOrder.update({
          where: { id },
          data: {
            ...(input.projectId ? { projectId: input.projectId } : {}),
            ...(input.date ? { date: input.date } : {}),
            ...(input.title !== undefined
              ? { title: input.title?.trim() || null }
              : {}),
            ...(input.workArea !== undefined
              ? { workArea: input.workArea?.trim() || null }
              : {}),
            ...(input.clientName !== undefined
              ? { clientName: input.clientName?.trim() || null }
              : {}),
            ...(input.address !== undefined
              ? { address: input.address?.trim() || null }
              : {}),
            ...(input.notes !== undefined
              ? { notes: input.notes?.trim() || null }
              : {}),
            status,
            startedAt,
            completedAt,
            updatedById: input.updatedById,
          },
          include: includeDetail,
        });
      },
      { timeout: 20_000 }
    );

    return mapOrder(row);
  }

  static async setStatus(
    id: string,
    foremanId: string,
    status: WorkOrderStatus,
    userId: string
  ) {
    return this.update(id, foremanId, { status, updatedById: userId });
  }

  static async delete(id: string, foremanId: string) {
    const existing = await prisma.workOrder.findFirst({
      where: { id, foremanId },
      select: { id: true, status: true },
    });
    if (!existing) throw new Error("סידור עבודה לא נמצא");
    if (existing.status === "completed") {
      throw new Error("לא ניתן למחוק סידור שהושלם — בטלו אותו במקום");
    }
    await prisma.workOrder.delete({ where: { id } });
  }

  static async addMedia(
    workOrderId: string,
    foremanId: string,
    media: {
      kind?: string;
      name: string;
      url: string;
      path?: string | null;
      bucket?: string | null;
      size?: number;
    }
  ) {
    const existing = await prisma.workOrder.findFirst({
      where: { id: workOrderId, foremanId },
      select: { id: true },
    });
    if (!existing) throw new Error("סידור עבודה לא נמצא");

    const row = await prisma.workOrderMedia.create({
      data: {
        workOrderId,
        kind: media.kind || "photo",
        name: media.name,
        url: media.url,
        path: media.path || null,
        bucket: media.bucket || null,
        size: media.size ?? 0,
      },
    });

    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      url: row.url,
      path: row.path,
      size: row.size,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
