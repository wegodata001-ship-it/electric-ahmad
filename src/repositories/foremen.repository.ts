import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { AuditRepository } from "./audit.repository";
import type { EmployeeStatus } from "@prisma/client";

function hoursInRange(
  workers: { totalHours: number; journal: { date: Date } }[],
  from: Date,
  to: Date
) {
  return workers
    .filter((w) => w.journal.date >= from && w.journal.date <= to)
    .reduce((s, w) => s + (w.totalHours || 0), 0);
}

export class ForemenRepository {
  /** Employees who act as field managers (role or assigned as project foreman). */
  static async listSummaries(includeDeleted = false) {
    const foremen = await prisma.employee.findMany({
      where: {
        ...(includeDeleted ? {} : { isDeleted: false }),
        OR: [
          { role: { in: ["foreman", "manager"] } },
          { foremanProjects: { some: {} } },
          { user: { role: "FIELD_MANAGER" } },
        ],
      },
      include: {
        user: { select: { username: true } },
        foremanProjects: {
          where: { status: "active" },
          select: { id: true, name: true },
        },
        projectLinks: {
          where: { project: { status: "active" } },
          select: { projectId: true },
        },
        workOrders: {
          select: {
            id: true,
            status: true,
            date: true,
            _count: { select: { media: true } },
            workers: { select: { hours: true } },
          },
        },
        fieldCrewMembers: {
          where: { status: "active" },
          select: { id: true },
        },
        _count: {
          select: {
            reports: true,
            galleryItems: true,
            workOrders: true,
          },
        },
      },
      orderBy: [{ isDeleted: "asc" }, { status: "asc" }, { lastName: "asc" }],
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return foremen.map((f) => {
      const openJournals = f.workOrders.filter(
        (j) =>
          j.status === "draft" ||
          j.status === "assigned" ||
          j.status === "in_progress"
      ).length;
      const closedJournals = f.workOrders.filter(
        (j) => j.status === "completed"
      ).length;
      const photos =
        f.workOrders.reduce((sum, j) => sum + j._count.media, 0) +
        f._count.galleryItems;

      const teamProjectIds = new Set([
        ...f.foremanProjects.map((p) => p.id),
        ...f.projectLinks.map((p) => p.projectId),
      ]);

      const flatWorkers = f.workOrders.flatMap((j) =>
        j.workers.map((w) => ({
          totalHours: w.hours,
          journal: { date: j.date },
        }))
      );

      return {
        id: f.id,
        firstName: f.firstName,
        lastName: f.lastName,
        fullName: `${f.firstName} ${f.lastName}`,
        phone: f.phone,
        email: f.email,
        status: f.status,
        role: f.role,
        isDeleted: f.isDeleted,
        username: f.user?.username ?? null,
        notes: f.notes,
        joinedAt: f.joinedAt.toISOString(),
        activeProjects: f.foremanProjects.map((p) => ({
          id: p.id,
          name: p.name,
        })),
        activeProjectCount: f.foremanProjects.length,
        teamCount: teamProjectIds.size,
        openJournals,
        closedJournals,
        reportsCount: f._count.workOrders || f._count.reports,
        photosCount: photos,
        crewCount: f.fieldCrewMembers.length,
        hoursThisMonth: hoursInRange(flatWorkers, monthStart, now),
        hoursThisYear: hoursInRange(flatWorkers, yearStart, now),
      };
    });
  }

  static async getDetail(id: string) {
    const emp = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: { select: { username: true, id: true } },
        foremanProjects: {
          select: {
            id: true,
            name: true,
            location: true,
            status: true,
            contractNumber: true,
          },
          orderBy: { updatedAt: "desc" },
        },
        fieldCrewMembers: {
          orderBy: { name: "asc" },
        },
        workOrders: {
          include: {
            project: { select: { name: true } },
            workers: true,
            vehicles: true,
            media: true,
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 100,
        },
        reports: {
          include: {
            project: { select: { name: true } },
            boqItem: { select: { code: true, description: true, unit: true } },
          },
          orderBy: { reportedAt: "desc" },
          take: 50,
        },
        galleryItems: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });

    if (!emp) return null;

    const activities = await prisma.activity.findMany({
      where: {
        OR: [
          { metadata: { contains: emp.id } },
          {
            projectId: { in: emp.foremanProjects.map((p) => p.id) },
            type: { in: ["report_created", "quantity_updated"] },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const flatWorkers = emp.workOrders.flatMap((j) =>
      j.workers.map((w) => ({
        totalHours: w.hours,
        journal: { date: j.date },
      }))
    );

    return {
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      fullName: `${emp.firstName} ${emp.lastName}`,
      phone: emp.phone,
      email: emp.email,
      status: emp.status,
      role: emp.role,
      isDeleted: emp.isDeleted,
      notes: emp.notes ?? "",
      username: emp.user?.username ?? null,
      userId: emp.user?.id ?? null,
      joinedAt: emp.joinedAt.toISOString(),
      createdAt: emp.createdAt.toISOString(),
      stats: {
        journalsCount: emp.workOrders.length,
        reportsCount: emp.workOrders.filter((o) => o.status === "completed")
          .length,
        activeCrew: emp.fieldCrewMembers.filter((c) => c.status === "active")
          .length,
        hoursThisMonth: hoursInRange(flatWorkers, monthStart, now),
        hoursThisYear: hoursInRange(flatWorkers, yearStart, now),
        activeProjects: emp.foremanProjects.filter((p) => p.status === "active")
          .length,
      },
      projects: emp.foremanProjects,
      crew: emp.fieldCrewMembers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone ?? "",
        profession: c.profession ?? "",
        status: c.status,
        notes: c.notes ?? "",
      })),
      journals: emp.workOrders.map((j) => ({
        id: j.id,
        date: j.date.toISOString().slice(0, 10),
        projectId: j.projectId,
        projectName: j.project.name,
        status: j.status,
        workArea: j.workArea,
        notes: j.notes,
        submittedAt: j.completedAt?.toISOString() ?? null,
        workers: j.workers.map((w) => ({
          name: w.name,
          profession: w.role,
          startTime: w.startTime,
          endTime: w.endTime,
          totalHours: w.hours,
          status: "assigned",
          note: w.notes,
        })),
        actionsPerformed: null,
        exceptions: null,
        equipment: j.vehicles.map((v) => v.name).join(", ") || null,
        clientName: j.clientName,
        address: j.address,
        lines: [] as {
          code: string;
          description: string;
          unit: string;
          quantity: number;
          note: string | null;
        }[],
        media: j.media.map((m) => ({
          id: m.id,
          type: m.kind,
          url: m.url,
          name: m.name,
        })),
      })),
      dailyReports: emp.workOrders
        .filter((o) => o.status === "completed")
        .map((r) => ({
          id: r.id,
          projectName: r.project.name,
          date: r.date.toISOString().slice(0, 10),
          status: r.status,
          submittedAt: (r.completedAt ?? r.updatedAt).toISOString(),
          workersCount: r.workers.length,
          totalHours: r.workers.reduce((s, w) => s + (w.hours || 0), 0),
        })),
      reports: emp.reports.map((r) => ({
        id: r.id,
        projectName: r.project.name,
        code: r.boqItem.code,
        description: r.boqItem.description,
        quantity: Number(r.quantity),
        unit: r.boqItem.unit,
        notes: r.notes,
        reportedAt: r.reportedAt.toISOString(),
      })),
      media: [
        ...emp.galleryItems.map((g) => ({
          id: g.id,
          type: g.type,
          url: g.url,
          title: g.title,
          source: "gallery" as const,
          createdAt: g.createdAt.toISOString(),
        })),
        ...emp.workOrders.flatMap((j) =>
          j.media.map((m) => ({
            id: m.id,
            type: m.kind,
            url: m.url,
            title: m.name,
            source: "journal" as const,
            createdAt: m.createdAt.toISOString(),
          }))
        ),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        createdAt: a.createdAt.toISOString(),
        projectId: a.projectId,
      })),
    };
  }

  static async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      status?: EmployeeStatus;
      notes?: string;
      projectIds?: string[];
    },
    actorUserId: string
  ) {
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp || emp.isDeleted) throw new Error("מנהל עבודה לא נמצא");

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined
          ? { firstName: data.firstName.trim() }
          : {}),
        ...(data.lastName !== undefined
          ? { lastName: data.lastName.trim() }
          : {}),
        ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
        ...(data.email !== undefined
          ? { email: data.email.trim().toLowerCase() }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.notes !== undefined
          ? { notes: data.notes.trim() || null }
          : {}),
      },
    });

    if (data.projectIds) {
      for (const projectId of data.projectIds) {
        await prisma.project.update({
          where: { id: projectId },
          data: { foremanId: id },
        });
        await prisma.projectEmployee.upsert({
          where: {
            projectId_employeeId: { projectId, employeeId: id },
          },
          create: { projectId, employeeId: id },
          update: {},
        });
      }
    }

    if (emp.userId && (data.firstName || data.lastName)) {
      await prisma.user.update({
        where: { id: emp.userId },
        data: {
          name: `${updated.firstName} ${updated.lastName}`,
        },
      });
    }

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "Employee",
      entityId: id,
      userId: actorUserId,
      metadata: { kind: "foreman_update" },
    });

    return this.getDetail(id);
  }

  static async setActive(
    id: string,
    active: boolean,
    actorUserId: string
  ) {
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp || emp.isDeleted) throw new Error("מנהל עבודה לא נמצא");

    await prisma.employee.update({
      where: { id },
      data: { status: active ? "active" : "inactive" },
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "Employee",
      entityId: id,
      userId: actorUserId,
      metadata: { status: active ? "active" : "inactive" },
    });

    return this.getDetail(id);
  }

  static async softDelete(id: string, actorUserId: string) {
    const emp = await prisma.employee.findUnique({ where: { id } });
    if (!emp) throw new Error("מנהל עבודה לא נמצא");
    if (emp.isDeleted) return this.getDetail(id);

    await prisma.employee.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: "inactive",
      },
    });

    await AuditRepository.log({
      action: "DELETE",
      entityType: "Employee",
      entityId: id,
      userId: actorUserId,
      metadata: { soft: true },
    });

    return this.getDetail(id);
  }

  static async resetPassword(
    id: string,
    newPassword: string,
    actorUserId: string
  ) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error("סיסמה חייבת לפחות 6 תווים");
    }
    const emp = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!emp || emp.isDeleted) throw new Error("מנהל עבודה לא נמצא");
    if (!emp.userId || !emp.user) {
      throw new Error("למנהל העבודה אין משתמש מערכת");
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: emp.userId },
      data: { passwordHash },
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "User",
      entityId: emp.userId,
      userId: actorUserId,
      metadata: { kind: "password_reset", employeeId: id },
    });

    return { ok: true, username: emp.user.username };
  }
}
