import {
  ATTENDANCE_CONFIG_KEYS,
  defaultAttendanceLabConfig,
  isWithinLabRadius,
  type AttendanceLabConfig,
} from "@/lib/attendance/lab-config";
import {
  ATTENDANCE_DEBOUNCE_MS,
  decideDebounce,
  isTrustedDevice,
} from "@/lib/attendance/attendance-rules";
import { AuditRepository } from "@/repositories/audit.repository";
import { uploadToStorage } from "@/lib/supabase/storage";
import { officeRoleLabel } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

export type CheckinMeta = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  deviceId: string;
  deviceType?: string | null;
  userAgent?: string | null;
  osName?: string | null;
  browserName?: string | null;
  ipAddress?: string | null;
  /** Always QR for lab attendance */
  source?: "qr" | "manual";
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
  | {
      status: "needs_enrollment";
      code: "needs_enrollment";
      message: string;
    }
  | { status: "error"; code: string; message: string };

function detectBrowserFromUa(ua?: string | null): string | null {
  if (!ua) return null;
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  return "דפדפן";
}

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

async function logFailedAttempt(opts: {
  userId: string;
  code: string;
  message: string;
  meta?: Partial<CheckinMeta>;
}) {
  await AuditRepository.log({
    action: "UPDATE",
    entityType: "OfficeAttendance",
    entityId: opts.userId,
    userId: opts.userId,
    metadata: {
      action: "attendance_failed",
      code: opts.code,
      message: opts.message,
      latitude: opts.meta?.latitude ?? null,
      longitude: opts.meta?.longitude ?? null,
      deviceId: opts.meta?.deviceId ?? null,
      ipAddress: opts.meta?.ipAddress ?? null,
      userAgent: opts.meta?.userAgent ?? null,
      osName: opts.meta?.osName ?? null,
      source: "qr",
    },
  });
}

export const AttendanceCheckinRepository = {
  async getConfig() {
    return loadLabConfig();
  },

  async findDevice(deviceId: string) {
    return prisma.attendanceDevice.findUnique({ where: { deviceId } });
  },

  /** Status for check-in page bootstrap */
  async getDeviceStatus(deviceId: string, userId: string) {
    const device = deviceId
      ? await prisma.attendanceDevice.findUnique({ where: { deviceId } })
      : null;
    const trusted =
      device && device.userId === userId && isTrustedDevice(device);
    return {
      needsEnrollment: !trusted,
      deviceTrusted: !!trusted,
      deviceId: device?.deviceId ?? null,
    };
  },

  async listDevices() {
    return prisma.attendanceDevice.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        user: {
          select: { id: true, name: true, email: true, username: true, role: true },
        },
      },
    });
  },

  /** Employee registration roster for admin / secretary */
  async listEmployeeRoster() {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        attendanceDevices: {
          orderBy: [{ enrolledAt: "desc" }, { updatedAt: "desc" }],
          take: 3,
        },
        officeAttendances: {
          orderBy: { checkedInAt: "desc" },
          take: 1,
          select: {
            id: true,
            checkedInAt: true,
            checkedOutAt: true,
            source: true,
          },
        },
      },
    });

    return users.map((u) => {
      const trusted = u.attendanceDevices.find((d) => isTrustedDevice(d));
      const device = trusted ?? u.attendanceDevices[0] ?? null;
      const lastAtt = u.officeAttendances[0] ?? null;
      const enrolled = Boolean(trusted);
      return {
        userId: u.id,
        userName: u.name,
        role: u.role,
        roleLabel: officeRoleLabel(u.role),
        email: u.email,
        registered: enrolled,
        statusLabel: enrolled ? "מכשיר רשום" : "עדיין לא נרשם",
        enrolledAt: trusted?.enrolledAt?.toISOString() ?? null,
        deviceRowId: device?.id ?? null,
        deviceId: device?.deviceId ?? null,
        deviceType: device?.deviceType ?? null,
        osName: device?.osName ?? null,
        browserName: detectBrowserFromUa(device?.userAgent),
        userAgent: device?.userAgent ?? null,
        lastSeenAt: device?.lastSeenAt?.toISOString() ?? null,
        lastCheckInAt: lastAtt?.checkedInAt?.toISOString() ?? null,
        lastCheckOutAt: lastAtt?.checkedOutAt?.toISOString() ?? null,
        approved: device?.approved ?? false,
      };
    });
  },

  async listAttendanceLogs(userId: string, take = 50) {
    return prisma.officeAttendance.findMany({
      where: { userId },
      orderBy: { checkedInAt: "desc" },
      take,
      select: {
        id: true,
        checkedInAt: true,
        checkedOutAt: true,
        source: true,
        latitude: true,
        longitude: true,
        ipAddress: true,
        deviceId: true,
        deviceType: true,
        osName: true,
        userAgent: true,
        accuracyMeters: true,
      },
    });
  },

  async setDeviceApproved(
    deviceRowId: string,
    approved: boolean,
    adminId: string
  ) {
    const existing = await prisma.attendanceDevice.findUnique({
      where: { id: deviceRowId },
    });
    if (!existing) throw new Error("מכשיר לא נמצא");

    const row = await prisma.attendanceDevice.update({
      where: { id: deviceRowId },
      data: {
        approved,
        approvedAt: approved ? new Date() : null,
        approvedById: approved ? adminId : null,
        ...(approved
          ? {
              enrolledAt: existing.enrolledAt ?? new Date(),
            }
          : { enrolledAt: null, termsAcceptedAt: null }),
      },
    });
    await AuditRepository.log({
      action: "UPDATE",
      entityType: "AttendanceDevice",
      entityId: row.id,
      userId: adminId,
      metadata: {
        action: approved ? "admin_reapprove_device" : "admin_revoke_device",
        deviceId: row.deviceId,
        targetUserId: row.userId,
      },
    });
    return row;
  },

  /** Reset enrollment so worker must run wizard again */
  async resetDevice(deviceRowId: string, adminId: string) {
    const row = await prisma.attendanceDevice.update({
      where: { id: deviceRowId },
      data: {
        approved: false,
        approvedAt: null,
        approvedById: null,
        enrolledAt: null,
        termsAcceptedAt: null,
        selfieUrl: null,
        selfiePath: null,
        selfieBucket: null,
        enrollLatitude: null,
        enrollLongitude: null,
      },
    });
    await AuditRepository.log({
      action: "UPDATE",
      entityType: "AttendanceDevice",
      entityId: row.id,
      userId: adminId,
      metadata: {
        action: "reset_enrollment",
        deviceId: row.deviceId,
        targetUserId: row.userId,
      },
    });
    return row;
  },

  async deleteDevice(deviceRowId: string, adminId: string) {
    const row = await prisma.attendanceDevice.delete({
      where: { id: deviceRowId },
    });
    await AuditRepository.log({
      action: "DELETE",
      entityType: "AttendanceDevice",
      entityId: row.id,
      userId: adminId,
      metadata: {
        action: "delete_device",
        deviceId: row.deviceId,
        targetUserId: row.userId,
      },
    });
    return row;
  },

  /**
   * One-time enrollment: GPS + selfie + optional terms → Trusted Device
   */
  async enrollDevice(opts: {
    userId: string;
    deviceId: string;
    selfieBase64: string;
    latitude: number;
    longitude: number;
    termsAccepted?: boolean;
    userAgent?: string | null;
    deviceType?: string | null;
    osName?: string | null;
  }) {
    const deviceId = opts.deviceId.trim();
    if (!deviceId) throw new Error("לא ניתן לזהות את המכשיר");
    if (!opts.selfieBase64?.startsWith("data:image")) {
      throw new Error("יש לצלם תמונת סלפי");
    }
    if (!Number.isFinite(opts.latitude) || !Number.isFinite(opts.longitude)) {
      throw new Error("יש לאשר GPS");
    }

    let selfieUrl = opts.selfieBase64.slice(0, 1_500_000);
    let selfiePath: string | null = null;
    let selfieBucket: string | null = null;

    try {
      const match = opts.selfieBase64.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
      );
      if (match) {
        const mime = match[1];
        const buf = Buffer.from(match[2], "base64");
        if (buf.length > 0 && buf.length < 8 * 1024 * 1024) {
          const uploaded = await uploadToStorage({
            file: buf,
            fileName: `selfie-${deviceId.slice(0, 8)}.jpg`,
            mimeType: mime,
            size: buf.length,
            bucketKey: "images",
            projectId: "__attendance__",
            subfolder: opts.userId,
          });
          selfieUrl = uploaded.url;
          selfiePath = uploaded.path;
          selfieBucket = uploaded.bucket;
        }
      }
    } catch {
      // Keep data-URL fallback if storage upload fails
    }

    const now = new Date();
    const existing = await prisma.attendanceDevice.findUnique({
      where: { deviceId },
    });

    const data = {
      userId: opts.userId,
      approved: true,
      approvedAt: now,
      approvedById: opts.userId,
      enrolledAt: now,
      termsAcceptedAt: opts.termsAccepted ? now : null,
      selfieUrl,
      selfiePath,
      selfieBucket,
      enrollLatitude: opts.latitude,
      enrollLongitude: opts.longitude,
      lastSeenAt: now,
      userAgent: opts.userAgent,
      deviceType: opts.deviceType,
      osName: opts.osName,
      label: "מכשיר מאומן",
    };

    const row = existing
      ? await prisma.attendanceDevice.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.attendanceDevice.create({
          data: { deviceId, ...data },
        });

    await AuditRepository.log({
      action: existing ? "UPDATE" : "CREATE",
      entityType: "AttendanceDevice",
      entityId: row.id,
      userId: opts.userId,
      metadata: {
        action: "enroll_trusted_device",
        deviceId,
        hasSelfie: true,
        termsAccepted: Boolean(opts.termsAccepted),
        latitude: opts.latitude,
        longitude: opts.longitude,
        osName: opts.osName,
        userAgent: opts.userAgent,
      },
    });

    return row;
  },

  async autoToggle(
    userId: string,
    userName: string,
    meta: CheckinMeta
  ): Promise<CheckinResult> {
    if (!meta.deviceId?.trim()) {
      await logFailedAttempt({
        userId,
        code: "device_missing",
        message: "לא ניתן לזהות את המכשיר",
        meta,
      });
      return {
        status: "error",
        code: "device_missing",
        message: "לא ניתן לזהות את המכשיר",
      };
    }

    const device = await prisma.attendanceDevice.findUnique({
      where: { deviceId: meta.deviceId.trim() },
    });

    if (!device || device.userId !== userId || !isTrustedDevice(device)) {
      await logFailedAttempt({
        userId,
        code: "device_not_approved",
        message: "המכשיר אינו מאושר",
        meta,
      });
      return {
        status: "needs_enrollment",
        code: "needs_enrollment",
        message: "נדרשת הרשמה חד-פעמית למכשיר זה",
      };
    }

    await prisma.attendanceDevice.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        userAgent: meta.userAgent ?? device.userAgent,
        deviceType: meta.deviceType ?? device.deviceType,
        osName: meta.osName ?? device.osName,
      },
    });

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
      await logFailedAttempt({
        userId,
        code: "out_of_range",
        message: "אינך נמצא בטווח המעבדה",
        meta,
      });
      return {
        status: "error",
        code: "out_of_range",
        message: "אינך נמצא בטווח המעבדה",
      };
    }

    const since = new Date(Date.now() - ATTENDANCE_DEBOUNCE_MS);

    const open = await prisma.officeAttendance.findFirst({
      where: { userId, checkedOutAt: null },
      orderBy: { checkedInAt: "desc" },
    });

    const [recentOut, recentIn] = await Promise.all([
      prisma.officeAttendance.findFirst({
        where: { userId, checkedOutAt: { gte: since } },
        orderBy: { checkedOutAt: "desc" },
        select: { checkedOutAt: true, checkedInAt: true },
      }),
      prisma.officeAttendance.findFirst({
        where: { userId, checkedInAt: { gte: since } },
        orderBy: { checkedInAt: "desc" },
        select: { checkedOutAt: true, checkedInAt: true },
      }),
    ]);

    const debounce = decideDebounce({
      openExists: !!open,
      recentCheckOutAt: recentOut?.checkedOutAt ?? null,
      recentCheckInAt: recentIn?.checkedInAt ?? null,
    });

    if (debounce.block) {
      return {
        status: "already_recorded",
        action: debounce.action,
        userName,
        at: debounce.at.toISOString(),
        message: "הנוכחות כבר נרשמה לפני מספר שניות",
      };
    }

    const auditBase = {
      source: "qr" as const,
      latitude: meta.latitude,
      longitude: meta.longitude,
      accuracyMeters: meta.accuracyMeters ?? null,
      ipAddress: meta.ipAddress ?? null,
      deviceId: meta.deviceId,
      deviceType: meta.deviceType ?? null,
      userAgent: meta.userAgent ?? null,
      osName: meta.osName ?? null,
      browserName: meta.browserName ?? detectBrowserFromUa(meta.userAgent),
    };

    if (!open) {
      const row = await prisma.officeAttendance.create({
        data: {
          userId,
          checkedInAt: new Date(),
          source: auditBase.source,
          latitude: auditBase.latitude,
          longitude: auditBase.longitude,
          accuracyMeters: auditBase.accuracyMeters,
          ipAddress: auditBase.ipAddress,
          deviceId: auditBase.deviceId,
          deviceType: auditBase.deviceType,
          userAgent: auditBase.userAgent,
          osName: auditBase.osName,
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
        source: auditBase.source,
        latitude: auditBase.latitude,
        longitude: auditBase.longitude,
        accuracyMeters: auditBase.accuracyMeters,
        ipAddress: auditBase.ipAddress,
        deviceId: auditBase.deviceId,
        deviceType: auditBase.deviceType,
        userAgent: auditBase.userAgent,
        osName: auditBase.osName,
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

  /** Log client-side GPS failures */
  async logGpsFailure(
    userId: string,
    code: "gps_denied" | "gps_unavailable" | "gps_failed",
    meta?: Partial<CheckinMeta>
  ) {
    await logFailedAttempt({
      userId,
      code,
      message: "יש לאשר GPS",
      meta,
    });
  },
};
