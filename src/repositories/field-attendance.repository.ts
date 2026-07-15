import { prisma } from "@/lib/prisma";

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
    };
  }

  static async checkIn(foremanId: string, projectId?: string) {
    const open = await this.getOpen(foremanId);
    if (open) return open;

    const row = await prisma.fieldAttendance.create({
      data: {
        foremanId,
        projectId: projectId || null,
        checkedInAt: new Date(),
      },
    });
    return {
      id: row.id,
      foremanId: row.foremanId,
      projectId: row.projectId,
      checkedInAt: row.checkedInAt.toISOString(),
      checkedOutAt: null as string | null,
    };
  }

  static async checkOut(foremanId: string) {
    const open = await prisma.fieldAttendance.findFirst({
      where: { foremanId, checkedOutAt: null },
      orderBy: { checkedInAt: "desc" },
    });
    if (!open) throw new Error("אין כניסה פתוחה");

    const row = await prisma.fieldAttendance.update({
      where: { id: open.id },
      data: { checkedOutAt: new Date() },
    });
    return {
      id: row.id,
      foremanId: row.foremanId,
      projectId: row.projectId,
      checkedInAt: row.checkedInAt.toISOString(),
      checkedOutAt: row.checkedOutAt!.toISOString(),
    };
  }
}
