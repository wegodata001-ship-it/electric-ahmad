import { prisma } from "@/lib/prisma";
import { AuditRepository } from "./audit.repository";
import { BoqExecutionsRepository } from "./boq-executions.repository";
import { computeTotalHours } from "@/utils/work-hours";

function decimalToNumber(value: { toNumber?: () => number } | number): number {
  if (typeof value === "number") return value;
  if (value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

export type JournalWorkerInput = {
  crewMemberId: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  note?: string;
};

export type JournalBoqLineInput = {
  boqItemId: string;
  quantity: number;
  note?: string;
};

export type UpsertWorkJournalInput = {
  projectId: string;
  date: string;
  clientName?: string;
  address?: string;
  workArea?: string;
  generalNotes?: string;
  actionsPerformed?: string;
  exceptions?: string;
  equipment?: string;
  notes?: string;
  signatureData?: string | null;
  /** draft = טיוטה, in_progress = התחל יום עבודה */
  status?: "draft" | "in_progress";
  workers?: JournalWorkerInput[];
  lines?: JournalBoqLineInput[];
};

function toDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    );
  }
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function mapJournal(row: Awaited<ReturnType<typeof fetchJournal>>) {
  if (!row) return null;
  return {
    id: row.id,
    foremanId: row.foremanId,
    foremanName: `${row.foreman.firstName} ${row.foreman.lastName}`,
    projectId: row.projectId,
    projectName: row.project.name,
    projectLocation: row.project.location,
    projectContractor: row.project.contractor,
    date: row.date.toISOString().slice(0, 10),
    clientName: row.clientName ?? row.project.contractor ?? "",
    address: row.address ?? row.project.location ?? "",
    workArea: row.workArea ?? "",
    generalNotes: row.generalNotes ?? "",
    actionsPerformed: row.actionsPerformed ?? "",
    exceptions: row.exceptions ?? "",
    equipment: row.equipment ?? "",
    notes: row.notes ?? "",
    signatureData: row.signatureData ?? "",
    signedAt: row.signedAt?.toISOString() ?? null,
    status: row.status as "draft" | "in_progress" | "submitted",
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    workers: row.workers.map((w) => ({
      id: w.id,
      crewMemberId: w.crewMemberId,
      workerName: w.workerName,
      profession: w.profession ?? "",
      startTime: w.startTime ?? "",
      endTime: w.endTime ?? "",
      totalHours: w.totalHours,
      status: w.status,
      note: w.note ?? "",
    })),
    lines: row.lines.map((l) => ({
      id: l.id,
      boqItemId: l.boqItemId,
      code: l.boqItem.code,
      description: l.boqItem.description,
      unit: l.boqItem.unit,
      quantity: decimalToNumber(l.quantity),
      note: l.note ?? "",
      executionId: l.executionId,
    })),
    media: row.media.map((m) => ({
      id: m.id,
      type: m.type as "image" | "video",
      name: m.name,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl ?? m.url,
      size: m.size,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

const journalInclude = {
  foreman: { select: { firstName: true, lastName: true } },
  project: { select: { name: true, location: true, contractor: true } },
  workers: {
    include: {
      crewMember: { select: { id: true, name: true, profession: true } },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  lines: {
    include: {
      boqItem: {
        select: { code: true, description: true, unit: true },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  media: { orderBy: { createdAt: "asc" as const } },
};

async function fetchJournal(id: string) {
  return prisma.workJournal.findUnique({
    where: { id },
    include: journalInclude,
  });
}

async function resolveWorkerCreates(
  foremanId: string,
  workers: JournalWorkerInput[]
) {
  const ids = workers.map((w) => w.crewMemberId);
  const crew = await prisma.fieldCrewMember.findMany({
    where: { id: { in: ids }, managerId: foremanId },
  });
  const byId = new Map(crew.map((c) => [c.id, c]));

  return workers.map((w, i) => {
    const member = byId.get(w.crewMemberId);
    if (!member) {
      throw new Error("עובד אינו ברשימה האישית של מנהל העבודה");
    }
    return {
      crewMemberId: member.id,
      workerName: member.name,
      profession: member.profession,
      startTime: w.startTime?.trim() || null,
      endTime: w.endTime?.trim() || null,
      totalHours: computeTotalHours(w.startTime, w.endTime),
      status: w.status?.trim() || "present",
      note: w.note?.trim() || null,
      sortOrder: i,
    };
  });
}

export class WorkJournalsRepository {
  static async findById(id: string) {
    return mapJournal(await fetchJournal(id));
  }

  static async listForForeman(foremanId: string) {
    const rows = await prisma.workJournal.findMany({
      where: { foremanId },
      include: journalInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((r) => mapJournal(r)!);
  }

  static async listForOffice(filters?: {
    foremanId?: string;
    projectId?: string;
    status?: "draft" | "submitted";
  }) {
    const rows = await prisma.workJournal.findMany({
      where: {
        foremanId: filters?.foremanId,
        projectId: filters?.projectId,
        status: filters?.status,
      },
      include: journalInclude,
      orderBy: [{ date: "desc" }, { submittedAt: "desc" }],
    });
    return rows.map((r) => mapJournal(r)!);
  }

  static async findOpenDraft(foremanId: string, projectId?: string) {
    const row = await prisma.workJournal.findFirst({
      where: {
        foremanId,
        status: { in: ["draft", "in_progress"] },
        ...(projectId ? { projectId } : {}),
      },
      include: journalInclude,
      orderBy: { updatedAt: "desc" },
    });
    return mapJournal(row);
  }

  static async createDraft(
    foremanId: string,
    input: UpsertWorkJournalInput,
    userId: string
  ) {
    const foreman = await prisma.employee.findUnique({
      where: { id: foremanId },
      select: { status: true, isDeleted: true },
    });
    if (!foreman || foreman.isDeleted || foreman.status !== "active") {
      throw new Error("מנהל העבודה אינו פעיל — לא ניתן לפתוח יומן חדש");
    }

    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
    });
    if (!project) throw new Error("פרויקט לא נמצא");
    if (project.status !== "active" && project.status !== "planning") {
      throw new Error("ניתן לדווח רק על פרויקט פעיל");
    }

    const date = toDateOnly(input.date);
    const initialStatus = input.status === "in_progress" ? "in_progress" : "draft";
    const existing = await prisma.workJournal.findFirst({
      where: {
        foremanId,
        projectId: input.projectId,
        date,
        status: { in: ["draft", "in_progress"] },
      },
    });
    if (existing) {
      return this.updateDraft(existing.id, foremanId, input, userId);
    }

    const workerCreates = input.workers?.length
      ? await resolveWorkerCreates(foremanId, input.workers)
      : [];

    const created = await prisma.workJournal.create({
      data: {
        foremanId,
        projectId: input.projectId,
        date,
        clientName:
          input.clientName?.trim() || project.contractor || null,
        address: input.address?.trim() || project.location || null,
        workArea: input.workArea?.trim() || null,
        generalNotes: input.generalNotes?.trim() || null,
        actionsPerformed: input.actionsPerformed?.trim() || null,
        exceptions: input.exceptions?.trim() || null,
        equipment: input.equipment?.trim() || null,
        notes: input.notes?.trim() || null,
        signatureData: input.signatureData?.trim() || null,
        signedAt: input.signatureData?.trim() ? new Date() : null,
        status: initialStatus,
        createdById: userId,
        updatedById: userId,
        workers: workerCreates.length
          ? { create: workerCreates }
          : undefined,
        lines: input.lines?.length
          ? {
              create: input.lines
                .filter((l) => Number(l.quantity) > 0)
                .map((l, i) => ({
                  boqItemId: l.boqItemId,
                  quantity: Number(l.quantity),
                  note: l.note?.trim() || null,
                  sortOrder: i,
                })),
            }
          : undefined,
      },
      include: journalInclude,
    });

    await AuditRepository.log({
      action: "CREATE",
      entityType: "WorkJournal",
      entityId: created.id,
      userId,
      metadata: {
        managerId: foremanId,
        projectId: input.projectId,
        status: "draft",
      },
    });

    return mapJournal(created)!;
  }

  static async updateDraft(
    id: string,
    foremanId: string,
    input: Partial<UpsertWorkJournalInput>,
    userId: string
  ) {
    const existing = await prisma.workJournal.findUnique({ where: { id } });
    if (!existing) throw new Error("יומן לא נמצא");
    if (existing.foremanId !== foremanId) throw new Error("אין הרשאה");
    // draft / in_progress / submitted remain editable (submitted re-syncs to office)
    if (
      existing.status !== "draft" &&
      existing.status !== "in_progress" &&
      existing.status !== "submitted"
    ) {
      throw new Error("לא ניתן לערוך יומן זה");
    }

    if (input.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
      });
      if (!project) throw new Error("פרויקט לא נמצא");
    }

    const workerCreates = input.workers
      ? await resolveWorkerCreates(foremanId, input.workers)
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.workJournal.update({
        where: { id },
        data: {
          clientName:
            input.clientName !== undefined
              ? input.clientName.trim() || null
              : undefined,
          address:
            input.address !== undefined
              ? input.address.trim() || null
              : undefined,
          workArea:
            input.workArea !== undefined
              ? input.workArea.trim() || null
              : undefined,
          generalNotes:
            input.generalNotes !== undefined
              ? input.generalNotes.trim() || null
              : undefined,
          actionsPerformed:
            input.actionsPerformed !== undefined
              ? input.actionsPerformed.trim() || null
              : undefined,
          exceptions:
            input.exceptions !== undefined
              ? input.exceptions.trim() || null
              : undefined,
          equipment:
            input.equipment !== undefined
              ? input.equipment.trim() || null
              : undefined,
          notes:
            input.notes !== undefined ? input.notes.trim() || null : undefined,
          signatureData:
            input.signatureData !== undefined
              ? input.signatureData?.trim() || null
              : undefined,
          signedAt:
            input.signatureData !== undefined
              ? input.signatureData?.trim()
                ? new Date()
                : null
              : undefined,
          date: input.date ? toDateOnly(input.date) : undefined,
          projectId: input.projectId || undefined,
          status:
            existing.status !== "submitted" && input.status
              ? input.status
              : undefined,
          updatedById: userId,
        },
      });

      if (workerCreates) {
        await tx.workJournalWorker.deleteMany({ where: { journalId: id } });
        if (workerCreates.length) {
          await tx.workJournalWorker.createMany({
            data: workerCreates.map((w) => ({ ...w, journalId: id })),
          });
        }
      }

      if (input.lines) {
        await tx.workJournalBoqLine.deleteMany({ where: { journalId: id } });
        const valid = input.lines.filter((l) => Number(l.quantity) > 0);
        if (valid.length) {
          await tx.workJournalBoqLine.createMany({
            data: valid.map((l, i) => ({
              journalId: id,
              boqItemId: l.boqItemId,
              quantity: Number(l.quantity),
              note: l.note?.trim() || null,
              sortOrder: i,
            })),
          });
        }
      }
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "WorkJournal",
      entityId: id,
      userId,
      metadata: { managerId: foremanId, status: "draft" },
    });

    return (await this.findById(id))!;
  }

  static async addMedia(
    journalId: string,
    foremanId: string,
    media: {
      type: "image" | "video";
      name: string;
      extension: string;
      size: number;
      bucket: string;
      path: string;
      url: string;
      thumbnailUrl?: string;
    }
  ) {
    const journal = await prisma.workJournal.findUnique({
      where: { id: journalId },
    });
    if (!journal) throw new Error("יומן לא נמצא");
    if (journal.foremanId !== foremanId) throw new Error("אין הרשאה");

    return prisma.workJournalMedia.create({
      data: {
        journalId,
        type: media.type,
        name: media.name,
        extension: media.extension,
        size: media.size,
        bucket: media.bucket,
        path: media.path,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl ?? media.url,
      },
    });
  }

  /** Lock and send to office project manager. BOQ lines optional. */
  static async submit(id: string, foremanId: string, userId: string) {
    const journal = await fetchJournal(id);
    if (!journal) throw new Error("יומן לא נמצא");
    if (journal.foremanId !== foremanId) throw new Error("אין הרשאה");
    if (!journal.projectId) throw new Error("יש לבחור פרויקט");

    const foreman = await prisma.employee.findUnique({
      where: { id: foremanId },
      select: { status: true, isDeleted: true },
    });
    if (!foreman || foreman.isDeleted || foreman.status !== "active") {
      throw new Error("מנהל העבודה אינו פעיל — לא ניתן לשלוח דיווח");
    }

    const alreadySubmitted = journal.status === "submitted";

    // Create executions only for new lines (avoid double-count on re-sync)
    for (const line of journal.lines) {
      if (line.executionId) continue;
      const qty = decimalToNumber(line.quantity);
      if (!(qty > 0)) continue;
      const execution = await BoqExecutionsRepository.create(
        {
          projectId: journal.projectId,
          boqItemId: line.boqItemId,
          employeeId: journal.foremanId,
          foremanId: journal.foremanId,
          quantity: qty,
          executedAt: journal.date.toISOString(),
          status: "completed",
          notes: line.note || journal.actionsPerformed || undefined,
          source: "field",
        },
        userId
      );
      await prisma.workJournalBoqLine.update({
        where: { id: line.id },
        data: { executionId: execution.id },
      });
    }

    const submittedAt = new Date();
    await prisma.workJournal.update({
      where: { id },
      data: {
        status: "submitted",
        submittedAt,
        updatedById: userId,
      },
    });

    // Critical: create/refresh DailyReport so office /reports shows it immediately
    const { DailyReportsRepository } = await import(
      "@/repositories/daily-reports.repository"
    );
    const dailyReport = await DailyReportsRepository.upsertFromJournal(
      id,
      userId,
      submittedAt
    );

    if (!alreadySubmitted) {
      await prisma.activity.create({
        data: {
          projectId: journal.projectId,
          type: "report_created",
          title: "דיווח יומי נשלח למנהל הפרויקט",
          description: `${journal.foreman.firstName} ${journal.foreman.lastName} שלח דיווח ל־${journal.project.name}`,
          userId,
          metadata: JSON.stringify({
            workJournalId: id,
            dailyReportId: dailyReport.id,
            managerId: foremanId,
          }),
        },
      });
    }

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "WorkJournal",
      entityId: id,
      userId,
      metadata: {
        status: "submitted",
        managerId: foremanId,
        projectId: journal.projectId,
        dailyReportId: dailyReport.id,
        resync: alreadySubmitted,
        datetime: submittedAt.toISOString(),
      },
    });

    return (await this.findById(id))!;
  }
}
