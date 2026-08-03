import { prisma } from "@/lib/prisma";
import {
  ATTENDANCE_CONFIG_KEYS,
  ATTENDANCE_DEBOUNCE_MS,
  defaultAttendanceLabConfig,
  isWithinLabRadius,
  type AttendanceLabConfig,
} from "@/lib/attendance/lab-config";
import { AuditRepository } from "@/repositories/audit.repository";

export type CheckinMeta = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  deviceId: string;
  deviceType?: string | null;
  userAgent?: string | null;
  osName?: string | null;
  ipAddress?: string | null;
  source?: "qr" | "nfc" | "manual";
};

export type CheckinResult =
  | {
      status: "ok";
      action: "check_in" | "check_out";
      userName: string;
      at: string;
      attendanceId: string;
    }
  | {
      status: "already_recorded";
      action: "check_in" | "check_out";
      userName: string;
      at: string;
      message: string;
    }
  | { status: "error"; code: string; message: string };

async function loadLabConfig(): Promise<AttendanceLabConfig> {
  const defaults = defaultAttendanceLabConfig();
  const rows = await prisma.appConfig.findMany({
    where: {
      key: {
        in: [
          ATTENDANCE_CONFIG_KEYS.lat,
          ATTENDANCE_CONFIG_KEYS.lng,
          ATTENDANCE_CONFIG_KEYS.radiusM,
          ATTENDANCE_CONFIG_KEYS.brand,
        ],
      },
    },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const lat = Number(map[ATTENDANCE_CONFIG_KEYS.lat] ?? defaults.lat);
  const lng = Number(map[ATTENDANCE_CONFIG_KEYS.lng] ?? defaults.lng);
  const radiusM = Number(
    map[ATTENDANCE_CONFIG_KEYS.radiusM] ?? defaults.radiusM
  );
  return {
    lat: Number.isFinite(lat) ? lat : defaults.lat,
    lng: Number.isFinite(lng) ? lng : defaults.lng,
    radiusM:
      Number.isFinite(radiusM) && radiusM > 0 ? radiusM : defaults.radiusM,
    brandName: map[ATTENDANCE_CONFIG_KEYS.brand] || defaults.brandName,
    checkinPath: defaults.checkinPath,
  };
}

export const AttendanceCheckinRepository = {
  async getConfig() {
    return loadLabConfig();
  },

  async ensureDevice(opts: {
    deviceId: string;
    userId: string;
    userAgent?: string | null;
    deviceType?: string | null;
    osName?: string | null;
  }) {
    const existing = await prisma.attendanceDevice.findUnique({
      where: { deviceId: opts.deviceId },
    });
    if (existing) {
      return prisma.attendanceDevice.update({
        where: { id: existing.id },
        data: {
          userId: opts.userId,
          lastSeenAt: new Date(),
          userAgent: opts.userAgent ?? existing.userAgent,
          deviceType: opts.deviceType ?? existing.deviceType,
          osName: opts.osName ?? existing.osName,
        },
      });
    }
    // First device for a user auto-approves; additional devices need admin
    const priorApproved = await prisma.attendanceDevice.count({
      where: { userId: opts.userId, approved: true },
    });
    return prisma.attendanceDevice.create({
      data: {
        deviceId: opts.deviceId,
        userId: opts.userId,
        approved: priorApproved === 0,
        approvedAt: priorApproved === 0 ? new Date() : null,
        lastSeenAt: new Date(),
        userAgent: opts.userAgent,
        deviceType: opts.deviceType,
        osName: opts.osName,
        label: priorApproved === 0 ? "מכשיר ראשון" : "מכשיר חדש",
      },
    });
  },

  async listDevices() {
    return prisma.attendanceDevice.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true, username: true } },
      },
    });
  },

  async setDeviceApproved(deviceRowId: string, approved: boolean, adminId: string) {
    return prisma.attendanceDevice.update({
      where: { id: deviceRowId },
      data: {
        approved,
        approvedAt: approved ? new Date() : null,
        approvedById: approved ? adminId : null,
      },
    });
  },

  async autoToggle(userId: string, userName: string, meta: CheckinMeta): Promise<CheckinResult> {
    if (!meta.deviceId?.trim()) {
      return {
        status: "error",
        code: "device_missing",
        message: "לא ניתן לזהות את המכשיר",
      };
    }

    const device = await this.ensureDevice({
      deviceId: meta.deviceId.trim(),
      userId,
      userAgent: meta.userAgent,
      deviceType: meta.deviceType,
      osName: meta.osName,
    });

    if (!device.approved) {
      return {
        status: "error",
        code: "device_not_approved",
        message: "המכשיר אינו מאושר",
      };
    }

    const lab = await loadLabConfig();
    if (
      !isWithinLabRadius({
        userLat: meta.latitude,
        userLng: meta.longitude,
        labLat: lab.lat,
        labLng: lab.lng,
        radiusM: lab.radiusM,
      })
    ) {
      return {
        status: "error",
        code: "out_of_range",
        message: "אינך נמצא בטווח המעבדה",
      };
    }

    // Debounce: recent activity by same user OR same device
    const since = new Date(Date.now() - ATTENDANCE_DEBOUNCE_MS);
    const recentFixed = await prisma.officeAttendance.findFirst({
      where: {
        AND: [
          {
            OR: [{ userId }, { deviceId: meta.deviceId }],
          },
          {
            OR: [
              { checkedInAt: { gte: since } },
              { checkedOutAt: { gte: since } },
              { updatedAt: { gte: since } },
            ],
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    const open = await prisma.officeAttendance.findFirst({
      where: { userId, checkedOutAt: null },
      orderBy: { checkedInAt: "desc" },
    });

    if (recentFixed) {
      const lastAction: "check_in" | "check_out" = recentFixed.checkedOutAt
        ? "check_out"
        : "check_in";
      const at = (
        recentFixed.checkedOutAt ?? recentFixed.checkedInAt
      ).toISOString();
      return {
        status: "already_recorded",
        action: lastAction,
        userName,
        at,
        message: "הנוכחות כבר נרשמה",
      };
    }

    const auditBase = {
      source: meta.source ?? "qr",
      latitude: meta.latitude,
      longitude: meta.longitude,
      accuracyMeters: meta.accuracyMeters ?? null,
      ipAddress: meta.ipAddress ?? null,
      deviceId: meta.deviceId,
      deviceType: meta.deviceType ?? null,
      userAgent: meta.userAgent ?? null,
      osName: meta.osName ?? null,
    };

    if (!open) {
      const row = await prisma.officeAttendance.create({
        data: {
          userId,
          checkedInAt: new Date(),
          ...auditBase,
        },
      });
      await AuditRepository.log({
        action: "CREATE",
        entityType: "OfficeAttendance",
        entityId: row.id,
        userId,
        metadata: { action: "check_in", ...auditBase },
      });
      return {
        status: "ok",
        action: "check_in",
        userName,
        at: row.checkedInAt.toISOString(),
        attendanceId: row.id,
      };
    }

    const row = await prisma.officeAttendance.update({
      where: { id: open.id },
      data: {
        checkedOutAt: new Date(),
        ...auditBase,
      },
    });
    await AuditRepository.log({
      action: "UPDATE",
      entityType: "OfficeAttendance",
      entityId: row.id,
      userId,
      metadata: { action: "check_out", ...auditBase },
    });
    return {
      status: "ok",
      action: "check_out",
      userName,
      at: row.checkedOutAt!.toISOString(),
      attendanceId: row.id,
    };
  },
};
