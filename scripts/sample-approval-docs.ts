import { prisma } from "../src/lib/prisma";

async function main() {
  const [sheets, diaries, dns, users] = await Promise.all([
    prisma.measurementSheet.findMany({
      take: 8,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        projectId: true,
        createdById: true,
        _count: {
          select: { rows: true, cells: true, events: true, approvals: true },
        },
      },
    }),
    prisma.workDiary.findMany({
      where: { deletedAt: null },
      take: 8,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        documentNumber: true,
        status: true,
        projectId: true,
        createdById: true,
        workflowDocumentId: true,
      },
    }),
    prisma.opsDeliveryNote.findMany({
      where: { deletedAt: null },
      take: 8,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        documentNumber: true,
        status: true,
        projectId: true,
        createdById: true,
      },
    }),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: {
          in: [
            "SYSTEM_MANAGER",
            "OPERATIONS_MANAGER",
            "PROJECT_MANAGER",
            "ADMIN",
            "מנהל מערכת",
          ],
        },
      },
      take: 8,
      select: { id: true, name: true, role: true },
    }),
  ]);
  console.log(JSON.stringify({ sheets, diaries, dns, users }, null, 2));
}

void main().finally(() => prisma.$disconnect());
