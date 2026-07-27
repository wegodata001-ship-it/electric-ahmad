/**
 * Fix: foreman1 login → "חשבון שטח אינו מקושר לעובד"
 * Links existing foreman1 user to an active project foreman employee.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });
config({ path: ".env", override: false });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FIELD_MANAGER_ROLE = "FIELD_MANAGER";

async function main() {
  const user = await prisma.user.findFirst({
    where: { username: { equals: "foreman1", mode: "insensitive" } },
    include: { employee: true },
  });
  if (!user) throw new Error("User foreman1 not found");

  console.log("before", {
    userId: user.id,
    role: user.role,
    linkedEmployeeId: user.employee?.id ?? null,
  });

  if (user.employee && !user.employee.isDeleted) {
    if (user.role !== FIELD_MANAGER_ROLE) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: FIELD_MANAGER_ROLE },
      });
    }
    console.log("OK already linked →", user.employee.id);
    return;
  }

  const project = await prisma.project.findFirst({
    where: { status: "active" },
    include: { foreman: true },
    orderBy: { updatedAt: "desc" },
  });

  let emp = project?.foreman ?? null;

  if (!emp) {
    emp = await prisma.employee.findFirst({
      where: { role: "foreman", isDeleted: false, status: "active" },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!emp) {
    emp = await prisma.employee.create({
      data: {
        firstName: "מנהל",
        lastName: "עבודה",
        phone: "0500000001",
        email: "foreman1@wego-electric.local",
        role: "foreman",
        status: "active",
        joinedAt: new Date(),
      },
    });
    console.log("created employee", emp.id);
  }

  // If this employee is linked to a different user, detach first
  if (emp.userId && emp.userId !== user.id) {
    await prisma.employee.update({
      where: { id: emp.id },
      data: { userId: null },
    });
    console.log("detached previous user", emp.userId);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        role: FIELD_MANAGER_ROLE,
        name:
          user.name?.trim() ||
          `${emp.firstName} ${emp.lastName}`.trim() ||
          "מנהל עבודה",
      },
    }),
    prisma.employee.update({
      where: { id: emp.id },
      data: {
        userId: user.id,
        status: "active",
        isDeleted: false,
        deletedAt: null,
      },
    }),
  ]);

  const after = await prisma.user.findUnique({
    where: { id: user.id },
    include: { employee: true },
  });
  console.log("FIXED", {
    userId: after.id,
    role: after.role,
    employeeId: after.employee?.id,
    employeeName: after.employee
      ? `${after.employee.firstName} ${after.employee.lastName}`
      : null,
  });
  console.log("Login: foreman1 / (existing password) or Foreman123! / WegoAudit123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
