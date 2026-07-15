import { prisma } from "@/lib/prisma";
import { computeTotalHours } from "@/utils/work-hours";
import { AuditRepository } from "./audit.repository";

export type FieldCrewTimeInput = {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
};

function toDateOnly(value: string): Date {
  const d = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error("תאריך לא תקין");
  }
  return new Date(`${d}T00:00:00.000Z`);
}

function mapEntry(row: {
  id: string;
  crewMemberId: string;
  managerId: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  totalHours: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    crewMemberId: row.crewMemberId,
    managerId: row.managerId,
    date: row.date.toISOString().slice(0, 10),
    startTime: row.startTime ?? "",
    endTime: row.endTime ?? "",
    totalHours: row.totalHours,
    notes: row.notes ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export type CrewHoursSummary = {
  today: number;
  week: number;
  month: number;
  total: number;
};

export class FieldCrewTimeRepository {
  static async listForMember(crewMemberId: string, managerId: string) {
    const member = await prisma.fieldCrewMember.findUnique({
      where: { id: crewMemberId },
    });
    if (!member || member.managerId !== managerId) {
      throw new Error("עובד לא נמצא");
    }

    const rows = await prisma.fieldCrewTimeEntry.findMany({
      where: { crewMemberId, managerId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(mapEntry);
  }

  static async summaryForMember(
    crewMemberId: string,
    managerId: string
  ): Promise<CrewHoursSummary> {
    const member = await prisma.fieldCrewMember.findUnique({
      where: { id: crewMemberId },
    });
    if (!member || member.managerId !== managerId) {
      throw new Error("עובד לא נמצא");
    }

    const rows = await prisma.fieldCrewTimeEntry.findMany({
      where: { crewMemberId, managerId },
      select: { date: true, totalHours: true },
    });

    const todayStart = startOfLocalDay();
    const weekStart = addDays(todayStart, -((todayStart.getDay() + 6) % 7)); // Monday
    const monthStart = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth(),
      1
    );

    let today = 0;
    let week = 0;
    let month = 0;
    let total = 0;

    for (const row of rows) {
      const hours = Number(row.totalHours) || 0;
      total += hours;
      // Compare by YYYY-MM-DD in local via UTC date storage
      const key = row.date.toISOString().slice(0, 10);
      const localKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (key === localKey(todayStart)) today += hours;
      if (key >= localKey(weekStart) && key <= localKey(todayStart)) week += hours;
      if (key >= localKey(monthStart) && key <= localKey(todayStart)) {
        month += hours;
      }
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      today: round(today),
      week: round(week),
      month: round(month),
      total: round(total),
    };
  }

  static async create(
    crewMemberId: string,
    managerId: string,
    input: FieldCrewTimeInput,
    userId: string
  ) {
    const member = await prisma.fieldCrewMember.findUnique({
      where: { id: crewMemberId },
    });
    if (!member || member.managerId !== managerId) {
      throw new Error("עובד לא נמצא");
    }

    const date = toDateOnly(input.date);
    const startTime = input.startTime?.trim() || null;
    const endTime = input.endTime?.trim() || null;
    const totalHours = computeTotalHours(startTime, endTime);

    const row = await prisma.fieldCrewTimeEntry.create({
      data: {
        crewMemberId,
        managerId,
        date,
        startTime,
        endTime,
        totalHours,
        notes: input.notes?.trim() || null,
      },
    });

    await AuditRepository.log({
      action: "CREATE",
      entityType: "FieldCrewTimeEntry",
      entityId: row.id,
      userId,
      metadata: { crewMemberId, managerId, date: input.date, totalHours },
    });

    return mapEntry(row);
  }

  static async update(
    id: string,
    managerId: string,
    input: Partial<FieldCrewTimeInput>,
    userId: string
  ) {
    const existing = await prisma.fieldCrewTimeEntry.findUnique({
      where: { id },
    });
    if (!existing || existing.managerId !== managerId) {
      throw new Error("רישום לא נמצא");
    }

    const startTime =
      input.startTime !== undefined
        ? input.startTime?.trim() || null
        : existing.startTime;
    const endTime =
      input.endTime !== undefined
        ? input.endTime?.trim() || null
        : existing.endTime;
    const totalHours = computeTotalHours(startTime, endTime);

    const row = await prisma.fieldCrewTimeEntry.update({
      where: { id },
      data: {
        date: input.date !== undefined ? toDateOnly(input.date) : undefined,
        startTime: input.startTime !== undefined ? startTime : undefined,
        endTime: input.endTime !== undefined ? endTime : undefined,
        totalHours,
        notes:
          input.notes !== undefined
            ? input.notes?.trim() || null
            : undefined,
      },
    });

    await AuditRepository.log({
      action: "UPDATE",
      entityType: "FieldCrewTimeEntry",
      entityId: id,
      userId,
      metadata: {
        managerId,
        before: {
          date: existing.date.toISOString().slice(0, 10),
          startTime: existing.startTime,
          endTime: existing.endTime,
          totalHours: existing.totalHours,
          notes: existing.notes,
        },
        after: {
          date: row.date.toISOString().slice(0, 10),
          startTime: row.startTime,
          endTime: row.endTime,
          totalHours: row.totalHours,
          notes: row.notes,
        },
      },
    });

    return mapEntry(row);
  }

  static async remove(id: string, managerId: string, userId: string) {
    const existing = await prisma.fieldCrewTimeEntry.findUnique({
      where: { id },
    });
    if (!existing || existing.managerId !== managerId) {
      throw new Error("רישום לא נמצא");
    }
    await prisma.fieldCrewTimeEntry.delete({ where: { id } });
    await AuditRepository.log({
      action: "DELETE",
      entityType: "FieldCrewTimeEntry",
      entityId: id,
      userId,
      metadata: { managerId, crewMemberId: existing.crewMemberId },
    });
  }
}
