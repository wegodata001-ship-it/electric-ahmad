/**
 * Ensure the latest pending measurement sheet is assigned to foreman1
 * so the field portal can show it after the UI fix.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const foreman = await prisma.user.findFirst({
    where: { username: { equals: "foreman1", mode: "insensitive" } },
  });
  if (!foreman) throw new Error("foreman1 not found");

  const pending = await prisma.measurementSheetApproval.findFirst({
    where: { status: "pending" },
    orderBy: { sentAt: "desc" },
    include: { sheet: true },
  });
  if (!pending) {
    console.log("No pending sheet approvals");
    return;
  }

  const existing = await prisma.measurementSheetApproval.findFirst({
    where: {
      sheetId: pending.sheetId,
      approverId: foreman.id,
      status: "pending",
    },
  });
  if (existing) {
    console.log("Already assigned to foreman1", {
      sheetId: pending.sheetId,
      approvalId: existing.id,
    });
    return;
  }

  const created = await prisma.measurementSheetApproval.create({
    data: {
      sheetId: pending.sheetId,
      approverId: foreman.id,
      status: "pending",
      sentAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: foreman.id,
      projectId: pending.sheet.projectId,
      type: "document",
      title: "דוח ביצוע ממתין לאישור",
      message: `${pending.sheet.title} ממתין לאישורך`,
      link: "/field/approvals",
    },
  });

  console.log("ASSIGNED", {
    sheetId: pending.sheetId,
    title: pending.sheet.title,
    approvalId: created.id,
    foremanUserId: foreman.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
