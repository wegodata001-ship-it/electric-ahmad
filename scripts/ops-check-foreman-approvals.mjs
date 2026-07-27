import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({
    where: { username: { equals: "foreman1", mode: "insensitive" } },
    include: { employee: true },
  });
  console.log("foreman1", {
    userId: u?.id,
    empId: u?.employee?.id,
    role: u?.role,
  });

  const pending = await prisma.measurementSheetApproval.findMany({
    where: { status: "pending" },
    orderBy: { sentAt: "desc" },
    take: 20,
    include: {
      sheet: { select: { id: true, title: true, status: true, projectId: true } },
      approver: { select: { id: true, username: true, name: true, role: true } },
    },
  });
  console.log(
    "pendingApprovals",
    pending.map((a) => ({
      approvalId: a.id,
      approverId: a.approverId,
      approverUser: a.approver.username,
      mine: a.approverId === u?.id,
      sheetId: a.sheetId,
      sheetTitle: a.sheet.title,
      sheetStatus: a.sheet.status,
      sentAt: a.sentAt,
    }))
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
