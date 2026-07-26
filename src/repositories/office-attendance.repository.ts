import { prisma } from "@/lib/prisma";

export const OfficeAttendanceRepository = {
  async getOpen(userId: string) {
    return prisma.officeAttendance.findFirst({
      where: { userId, checkedOutAt: null },
      orderBy: { checkedInAt: "desc" },
    });
  },

  async checkIn(userId: string) {
    const open = await this.getOpen(userId);
    if (open) return open;
    return prisma.officeAttendance.create({
      data: { userId, checkedInAt: new Date() },
    });
  },

  async checkOut(userId: string) {
    const open = await this.getOpen(userId);
    if (!open) throw new Error("אין כניסה פתוחה");
    return prisma.officeAttendance.update({
      where: { id: open.id },
      data: { checkedOutAt: new Date() },
    });
  },
};
