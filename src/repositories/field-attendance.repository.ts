import { prisma } from "@/lib/prisma";
import { AuditRepository } from "@/repositories/audit.repository";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function hoursBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export type FieldGpsMeta = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  deviceLabel?: string | null;
  userAgent?: string | null;
};

function mapAttendance(row: {
  id: string;
  foremanId: string;
  projectId: string | null;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  deviceLabel?: string | null;
}) {
  const date = localDateKey(row.checkedInAt);
  const checkIn = formatTime(row.checkedInAt);
  const checkOut = row.checkedOutAt ? formatTime(row.checkedOutAt) : "";
  const hours = row.checkedOutAt
    ? hoursBetween(row.checkedInAt, row.checkedOutAt)
    : 0;

  return {
    id: row.id,
    foremanId: row.foremanId,
    projectId: row.projectId,
    date,
    checkedInAt: row.checkedInAt.toISOString(),
    checkedOutAt: row.checkedOutAt?.toISOString() ?? null,
    checkIn,
    checkOut,
    hours,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    accuracyMeters: row.accuracyMeters ?? null,
    deviceLabel: row.deviceLabel ?? null,
  };
}

export type AttendancePeriod = "today" | "week" | "month" | "range" | "all";

function requireGps(meta?: FieldGpsMeta | null) {
  if (
    !meta ||
    !Number.isFinite(meta.latitude) ||
    !Number.isFinite(meta.longitude)
  ) {
    throw new Error("יש לאשר GPS לפני דיווח נוכחות");
  }
}

export class FieldAttendanceRepository {
  static async getOpen(foremanId: string) {
    const row = await prisma.fieldAttendance.findFirst({
      where: { foremanId, checkedOutAt: null },
      orderBy: { checkedInAt: "desc" },
    });
    if (!row) return null;
    return {
      id: row.id,
      foremanId: row.foremanId,
      projectId: row.projectId,
      checkedInAt: row.checkedInAt.toISOString(),
      checkedOutAt: null as string | null,
      latitude: row.latitude,
      longitude: row.longitude,
      deviceLabel: row.deviceLabel,
    };
  }

  static async checkIn(
    foremanId: string,
    opts?: { projectId?: string; gps?: FieldGpsMeta; userId?: string }
  ) {
    requireGps(opts?.gps);
    const open = await this.getOpen(foremanId);
    if (open) return open;

    const gps = opts!.gps!;
    const row = await prisma.fieldAttendance.create({
      data: {
        foremanId,
        projectId: opts?.projectId || null,
        checkedInAt: new Date(),
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracyMeters: gps.accuracyMeters ?? null,
        deviceLabel: gps.deviceLabel ?? null,
        userAgent: gps.userAgent ?? null,
      },
    });

    if (opts?.userId) {
      await AuditRepository.log({
        action: "CREATE",
        entityType: "FieldAttendance",
        entityId: row.id,
        userId: opts.userId,
        metadata: {
          action: "check_in",
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracyMeters: gps.accuracyMeters ?? null,
          deviceLabel: gps.deviceLabel ?? null,
        },
      });
    }

    return {
      id: row.id,
      foremanId: row.foremanId,
      projectId: row.projectId,
      checkedInAt: row.checkedInAt.toISOString(),
      checkedOutAt: null as string | null,
      latitude: row.latitude,
      longitude: row.longitude,
      deviceLabel: row.deviceLabel,
    };
  }

  static async checkOut(
    foremanId: string,
    opts?: { gps?: FieldGpsMeta; userId?: string }
  ) {
    requireGps(opts?.gps);
    const open = await prisma.fieldAttendance.findFirst({
      where: { foremanId, checkedOutAt: null },
      orderBy: { checkedInAt: "desc" },
    });
    if (!open) throw new Error("אין כניסה פתוחה");

    const gps = opts!.gps!;
    const row = await prisma.fieldAttendance.update({
      where: { id: open.id },
      data: {
        checkedOutAt: new Date(),
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracyMeters: gps.accuracyMeters ?? null,
        deviceLabel: gps.deviceLabel ?? open.deviceLabel,
        userAgent: gps.userAgent ?? open.userAgent,
      },
    });

    if (opts?.userId) {
      await AuditRepository.log({
        action: "UPDATE",
        entityType: "FieldAttendance",
        entityId: row.id,
        userId: opts.userId,
        metadata: {
          action: "check_out",
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracyMeters: gps.accuracyMeters ?? null,
          deviceLabel: gps.deviceLabel ?? null,
        },
      });
    }

    return {
      id: row.id,
      foremanId: row.foremanId,
      projectId: row.projectId,
      checkedInAt: row.checkedInAt.toISOString(),
      checkedOutAt: row.checkedOutAt!.toISOString(),
      latitude: row.latitude,
      longitude: row.longitude,
      deviceLabel: row.deviceLabel,
    };
  }

  static resolveRange(
    period: AttendancePeriod,
    from?: string,
    to?: string
  ): { from: Date; to: Date } {
    const today = startOfLocalDay();
    const endExclusive = addDays(today, 1);

    if (period === "today") {
      return { from: today, to: endExclusive };
    }
    if (period === "week") {
      const weekStart = addDays(today, -((today.getDay() + 6) % 7));
      return { from: weekStart, to: endExclusive };
    }
    if (period === "month") {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: monthStart, to: endExclusive };
    }
    if (period === "range") {
      if (!from || !to) throw new Error("יש לבחור טווח תאריכים");
      const fromD = startOfLocalDay(new Date(`${from}T12:00:00`));
      const toD = addDays(startOfLocalDay(new Date(`${to}T12:00:00`)), 1);
      if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) {
        throw new Error("טווח תאריכים לא תקין");
      }
      return { from: fromD, to: toD };
    }
    return { from: addDays(today, -730), to: endExclusive };
  }

  static async listHistory(
    foremanId: string,
    period: AttendancePeriod = "month",
    from?: string,
    to?: string
  ) {
    const range = this.resolveRange(period, from, to);
    const rows = await prisma.fieldAttendance.findMany({
      where: {
        foremanId,
        checkedInAt: { gte: range.from, lt: range.to },
      },
      orderBy: { checkedInAt: "desc" },
    });
    return rows.map(mapAttendance);
  }

  static async personalSummary(foremanId: string) {
    const monthRange = this.resolveRange("month");
    const monthRows = await prisma.fieldAttendance.findMany({
      where: {
        foremanId,
        checkedInAt: { gte: monthRange.from, lt: monthRange.to },
      },
      orderBy: { checkedInAt: "desc" },
    });

    const mapped = monthRows.map(mapAttendance);
    const workDays = new Set(mapped.map((r) => r.date)).size;
    const monthHours = mapped.reduce((s, r) => s + r.hours, 0);
    const avgPerDay =
      workDays > 0 ? Math.round((monthHours / workDays) * 100) / 100 : 0;

    const lastIn = await prisma.fieldAttendance.findFirst({
      where: { foremanId },
      orderBy: { checkedInAt: "desc" },
    });
    const lastOut = await prisma.fieldAttendance.findFirst({
      where: { foremanId, checkedOutAt: { not: null } },
      orderBy: { checkedOutAt: "desc" },
    });

    return {
      workDays,
      monthHours: Math.round(monthHours * 100) / 100,
      avgPerDay,
      lastCheckIn: lastIn
        ? {
            at: lastIn.checkedInAt.toISOString(),
            date: localDateKey(lastIn.checkedInAt),
            time: formatTime(lastIn.checkedInAt),
          }
        : null,
      lastCheckOut: lastOut?.checkedOutAt
        ? {
            at: lastOut.checkedOutAt.toISOString(),
            date: localDateKey(lastOut.checkedOutAt),
            time: formatTime(lastOut.checkedOutAt),
          }
        : null,
    };
  }
}
