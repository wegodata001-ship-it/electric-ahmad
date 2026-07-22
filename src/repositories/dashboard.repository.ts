import { prisma } from "@/lib/prisma";
import { mapActivity, mapDashboardKPIs } from "@/lib/mappers";

export class DashboardRepository {
  static async getKPIs() {
    const [activeProjects, fieldEmployees, projects, todayReports, newDocuments] =
      await Promise.all([
        prisma.project.count({ where: { status: "active" } }),
        prisma.employee.count({ where: { status: "active", role: "worker" } }),
        prisma.project.findMany({ select: { contractValue: true, completedValue: true } }),
        (async () => {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const end = new Date();
          end.setHours(23, 59, 59, 999);
          return prisma.workReport.count({
            where: { reportedAt: { gte: start, lte: end } },
          });
        })(),
        (async () => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return prisma.document.count({ where: { createdAt: { gte: weekAgo } } });
        })(),
      ]);

    const totalContract = projects.reduce((s, p) => s + Number(p.contractValue), 0);
    const totalCompleted = projects.reduce((s, p) => s + Number(p.completedValue), 0);
    const overallProgress = totalContract > 0 ? (totalCompleted / totalContract) * 100 : 0;

    return mapDashboardKPIs({
      activeProjects,
      fieldEmployees,
      overallProgress: Math.round(overallProgress * 10) / 10,
      completedValue: totalCompleted,
      remainingValue: totalContract - totalCompleted,
      newDocuments,
      todayReports,
    });
  }

  static async getChartData() {
    const projects = await prisma.project.findMany({
      select: { name: true, contractValue: true, completedValue: true, progress: true },
    });
    return projects.map((p) => ({
      name: p.name.split(" - ")[0],
      completed: Number(p.completedValue),
      remaining: Number(p.contractValue) - Number(p.completedValue),
      progress: p.progress,
    }));
  }

  static async getProgressData() {
    const months = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי"];
    return months.map((month, i) => ({
      month,
      planned: 10 + i * 12,
      actual: 8 + i * 10 + 3,
    }));
  }

  static async search(query: string) {
    const q = query.toLowerCase();
    const [
      projectResults,
      employeeResults,
      boqResults,
      invoiceResults,
      deliveryResults,
      documentResults,
    ] = await Promise.all([
      prisma.project.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { contractNumber: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),
      prisma.employee.findMany({
        where: {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 3,
      }),
      prisma.boqItem.findMany({
        where: {
          deletedAt: null,
          OR: [
            { description: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 3,
      }),
      prisma.partialInvoice.findMany({
        where: {
          OR: [
            { invoiceNumber: { contains: q, mode: "insensitive" } },
            { billTo: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 3,
      }),
      prisma.deliveryNote.findMany({
        where: {
          OR: [
            { noteNumber: { contains: q, mode: "insensitive" } },
            { client: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 3,
      }),
      prisma.document.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { folderPath: { contains: q, mode: "insensitive" } },
            {
              attachments: {
                some: { name: { contains: q, mode: "insensitive" } },
              },
            },
          ],
        },
        take: 8,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return [
      ...projectResults.map((p) => ({
        id: p.id,
        type: "project" as const,
        title: p.name,
        subtitle: p.contractNumber,
        link: `/projects/${p.id}`,
      })),
      ...employeeResults.map((e) => ({
        id: e.id,
        type: "employee" as const,
        title: `${e.firstName} ${e.lastName}`,
        subtitle: e.role,
        link: "/employees",
      })),
      ...boqResults.map((b) => ({
        id: b.id,
        type: "boq_item" as const,
        title: b.description,
        subtitle: b.code,
        link: `/boq?projectId=${b.projectId}`,
      })),
      ...invoiceResults.map((inv) => ({
        id: inv.id,
        type: "invoice" as const,
        title: `חשבון ${inv.sequenceNumber}`,
        subtitle: inv.invoiceNumber,
        link: `/invoices/${inv.id}`,
      })),
      ...deliveryResults.map((dn) => ({
        id: dn.id,
        type: "delivery_note" as const,
        title: dn.noteNumber,
        subtitle: dn.client,
        link: `/delivery-notes/${dn.id}`,
      })),
      ...documentResults.map((d) => ({
        id: d.id,
        type: "document" as const,
        title: d.name,
        subtitle: d.folderPath || "מסמכים",
        link: `/invoices?projectId=${d.projectId}&module=documents`,
      })),
    ];
  }
}

export class ActivityRepository {
  static activityInclude = {
    project: { select: { name: true } },
    user: { select: { name: true } },
  } as const;

  static async findAll() {
    const rows = await prisma.activity.findMany({
      include: this.activityInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapActivity);
  }

  static async findByProject(projectId: string) {
    const rows = await prisma.activity.findMany({
      where: { projectId },
      include: this.activityInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapActivity);
  }

  static async findRecent(limit = 20) {
    const rows = await prisma.activity.findMany({
      take: limit,
      include: this.activityInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapActivity);
  }
}

export class NotificationsRepository {
  static async findAll(userId: string) {
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      read: r.read,
      projectId: r.projectId ?? undefined,
      link: r.link ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  static async markAsRead(id: string) {
    await prisma.notification.update({ where: { id }, data: { read: true } });
  }

  static async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
