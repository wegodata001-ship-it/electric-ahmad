import { prisma } from "@/lib/prisma";
import {
  ATTENDANCE_CONFIG_KEYS,
  ATTENDANCE_DEBOUNCE_MS,
  defaultAttendanceLabConfig,
  isWithinLabRadius,
  type AttendanceLabConfig,
} from "@/lib/attendance/lab-config";
import { AuditRepository } from "@/repositories/audit.repository";
import { uploadToStorage } from "@/lib/supabase/storage";

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
  | {
      status: "needs_enrollment";
      code: "needs_enrollment";
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

function isTrustedDevice(d: {
  approved: boolean;
  enrolledAt: Date | null;
}): boolean {
  return Boolean(d.approved && d.enrolledAt);
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
      device &&
      device.userId === userId &&
      isTrustedDevice(device);
    return {
      needsEnrollment: !trusted,
      deviceTrusted: !!trusted,
      deviceId: device?.deviceId ?? null,
    };
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

  async setDeviceApproved(
    deviceRowId: string,
    approved: boolean,
    adminId: string
  ) {
    return prisma.attendanceDevice.update({
      where: { id: deviceRowId },
      data: {
        approved,
        approvedAt: approved ? new Date() : null,
        approvedById: approved ? adminId : null,
        // Re-approve without clearing enrollment; reset clears enrollment
        ...(approved
          ? {}
          : { enrolledAt: null, termsAcceptedAt: null }),
      },
    });
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
      metadata: { action: "reset_enrollment", deviceId: row.deviceId },
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
      metadata: { action: "delete_device", deviceId: row.deviceId },
    });
    return row;
  },

  /**
   * One-time enrollment: selfie + GPS + optional terms → Trusted Device
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
      return {
        status: "error",
        code: "out_of_range",
        message: "אינך נמצא בטווח המעבדה",
      };
    }

    const since = new Date(Date.now() - ATTENDANCE_DEBOUNCE_MS);
    const recentFixed = await prisma.officeAttendance.findFirst({
      where: {
        AND: [
          { OR: [{ userId }, { deviceId: meta.deviceId }] },
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
