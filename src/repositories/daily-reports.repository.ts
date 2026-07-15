import { prisma } from "@/lib/prisma";
import type { DailyReportStatus } from "@prisma/client";
import { AuditRepository } from "./audit.repository";

const includeDetail = {
  project: {
    select: {
      id: true,
      name: true,
      contractor: true,
      location: true,
    },
  },
  foreman: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      status: true,
    },
  },
  workJournal: {
    include: {
      workers: { orderBy: { sortOrder: "asc" as const } },
      lines: {
        include: {
          boqItem: {
            select: { code: true, description: true, unit: true },
          },
        },
        orderBy: { sortOrder: "asc" as const },
      },
      media: { orderBy: { createdAt: "desc" as const } },
    },
  },
} as const;

function mapDailyReport(
  row: Awaited<ReturnType<typeof prisma.dailyReport.findFirst>> & {
    project: { id: string; name: string; contractor: string; location: string };
    foreman: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      email: string;
      status: string;
    };
    workJournal: {
      id: string;
      date: Date;
      clientName: string | null;
      address: string | null;
      workArea: string | null;
      generalNotes: string | null;
      actionsPerformed: string | null;
      exceptions: string | null;
      equipment: string | null;
      notes: string | null;
      signatureData: string | null;
      signedAt: Date | null;
      status: string;
      submittedAt: Date | null;
      workers: {
        id: string;
        workerName: string;
        profession: string | null;
        startTime: string | null;
        endTime: string | null;
        totalHours: number;
        status: string;
        note: string | null;
      }[];
      lines: {
        id: string;
        quantity: { toString(): string } | number;
        note: string | null;
        boqItem: { code: string; description: string; unit: string };
      }[];
      media: {
        id: string;
        type: string;
        name: string;
        url: string;
        thumbnailUrl: string | null;
      }[];
    };
  }
) {
  const workers = row.workJournal.workers;
  const totalHours = workers.reduce((s, w) => s + (w.totalHours || 0), 0);
  const startTimes = workers.map((w) => w.startTime).filter(Boolean) as string[];
  const endTimes = workers.map((w) => w.endTime).filter(Boolean) as string[];
  const startTime = startTimes.sort()[0] ?? null;
  const endTime = endTimes.sort().reverse()[0] ?? null;

  return {
    id: row.id,
    workJournalId: row.workJournalId,
    projectId: row.projectId,
    projectName: row.project.name,
    clientName:
      row.workJournal.clientName || row.project.contractor || "",
    address: row.workJournal.address || row.project.location || "",
    foremanId: row.foremanId,
    foremanName: `${row.foreman.firstName} ${row.foreman.lastName}`,
    foremanPhone: row.foreman.phone,
    foremanStatus: row.foreman.status,
    status: row.status as DailyReportStatus,
    date: row.workJournal.date.toISOString().slice(0, 10),
    submittedAt: row.submittedAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    officeNotes: row.officeNotes ?? "",
    workArea: row.workJournal.workArea ?? "",
    generalNotes: row.workJournal.generalNotes ?? "",
    actionsPerformed: row.workJournal.actionsPerformed ?? "",
    exceptions: row.workJournal.exceptions ?? "",
    equipment: row.workJournal.equipment ?? "",
    notes: row.workJournal.notes ?? "",
    signatureData: row.workJournal.signatureData ?? "",
    signedAt: row.workJournal.signedAt?.toISOString() ?? null,
    journalStatus: row.workJournal.status,
    startTime,
    endTime,
    totalHours,
    dayCompleted: row.workJournal.status === "submitted",
    workersCount: workers.length,
    workers: workers.map((w) => ({
      id: w.id,
      name: w.workerName,
      profession: w.profession ?? "",
      startTime: w.startTime ?? "",
      endTime: w.endTime ?? "",
      totalHours: w.totalHours,
      status: w.status,
      note: w.note ?? "",
    })),
    lines: row.workJournal.lines.map((l) => ({
      id: l.id,
      code: l.boqItem.code,
      description: l.boqItem.description,
      unit: l.boqItem.unit,
      quantity: Number(l.quantity),
      note: l.note ?? "",
    })),
    media: row.workJournal.media.map((m) => ({
      id: m.id,
      type: m.type as "image" | "video",
      name: m.name,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl ?? "",
    })),
    photoUrls: row.workJournal.media
      .filter((m) => m.type === "image")
      .map((m) => m.url),
    videoUrls: row.workJournal.media
      .filter((m) => m.type === "video")
      .map((m) => m.url),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DailyReportsRepository {
  /** Create or refresh the office report for a submitted journal (idempotent). */
  static async upsertFromJournal(
    journalId: string,
    userId: string,
    submittedAt = new Date()
  ) {
    const journal = await prisma.workJournal.findUnique({
      where: { id: journalId },
      select: {
        id: true,
        projectId: true,
        foremanId: true,
        dailyReport: { select: { id: true } },
      },
    });
    if (!journal) throw new Error("יומן לא נמצא");

    if (journal.dailyReport) {
      const updated = await prisma.dailyReport.update({
        where: { id: journal.dailyReport.id },
        data: {
          submittedAt,
          status: "submitted",
          updatedById: userId,
        },
        include: includeDetail,
      });
      return mapDailyReport(updated as never);
    }

    const created = await prisma.dailyReport.create({
      data: {
        workJournalId: journal.id,
        projectId: journal.projectId,
        foremanId: journal.foremanId,
        status: "submitted",
        submittedAt,
        createdById: userId,
        updatedById: userId,
      },
      include: includeDetail,
    });
    return mapDailyReport(created as never);
  }

  /** One-time repair: journals already submitted before DailyReport existed */
  static async backfillMissing(actorUserId: string) {
    const missing = await prisma.workJournal.findMany({
      where: { status: "submitted", dailyReport: null },
      select: {
        id: true,
        submittedAt: true,
        createdById: true,
      },
      take: 200,
    });
    for (const j of missing) {
      await this.upsertFromJournal(
        j.id,
        j.createdById || actorUserId,
        j.submittedAt ?? new Date()
      );
    }
    return missing.length;
  }

  static async findAll(filters?: {
    projectId?: string;
    foremanId?: string;
    status?: DailyReportStatus;
  }) {
    const rows = await prisma.dailyReport.findMany({
      where: {
        ...(filters?.projectId ? { projectId: filters.projectId } : {}),
        ...(filters?.foremanId ? { foremanId: filters.foremanId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      include: includeDetail,
      orderBy: { submittedAt: "desc" },
    });
    return rows.map((r) => mapDailyReport(r as never));
  }

  static async findById(id: string) {
    const row = await prisma.dailyReport.findUnique({
      where: { id },
      include: includeDetail,
    });
    return row ? mapDailyReport(row as never) : null;
  }

  static async findRecent(limit = 10) {
    const rows = await prisma.dailyReport.findMany({
      take: limit,
      include: includeDetail,
      orderBy: { submittedAt: "desc" },
    });
    return rows.map((r) => mapDailyReport(r as never));
  }

  static async updateOffice(
    id: string,
    data: { officeNotes?: string; status?: DailyReportStatus },
    userId: string
  ) {
    const patch: {
      officeNotes?: string | null;
      status?: DailyReportStatus;
      approvedAt?: Date | null;
      updatedById: string;
    } = { updatedById: userId };

    if (data.officeNotes !== undefined) {
      patch.officeNotes = data.officeNotes.trim() || null;
    }
    if (data.status) {
      patch.status = data.status;
      patch.approvedAt = data.status === "approved" ? new Date() : null;
    }

    const row = await prisma.dailyReport.update({
      where: { id },
      data: patch,
      include: includeDetail,
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "DailyReport",
      entityId: id,
      userId,
      metadata: { status: data.status, officeNotes: Boolean(data.officeNotes) },
    });

    return mapDailyReport(row as never);
  }
}
