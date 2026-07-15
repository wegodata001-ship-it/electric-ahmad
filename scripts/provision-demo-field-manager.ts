/**
 * Links the first active project foreman to FIELD_MANAGER login
 * username: foreman1 / password: Foreman123!
 * Does not wipe the database.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { FIELD_MANAGER_ROLE } from "../src/lib/auth/roles";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { username: "foreman1" },
    include: { employee: true },
  });
  if (existing?.employee) {
    console.log("Already provisioned: foreman1 →", existing.employee.id);
    return;
  }

  const project = await prisma.project.findFirst({
    where: { status: "active" },
    include: { foreman: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!project?.foreman) {
    throw new Error("No active project foreman found");
  }

  const emp = project.foreman;
  if (emp.userId) {
    await prisma.user.update({
      where: { id: emp.userId },
      data: {
        username: "foreman1",
        passwordHash: await hashPassword("Foreman123!"),
        role: FIELD_MANAGER_ROLE,
      },
    });
    console.log("Updated existing user for", emp.firstName, emp.lastName);
    console.log("Login: foreman1 / Foreman123!");
    return;
  }

  const email = `field.foreman1@wego-electric.local`;
  const user = await prisma.user.create({
    data: {
      email,
      username: "foreman1",
      passwordHash: await hashPassword("Foreman123!"),
      name: `${emp.firstName} ${emp.lastName}`,
      role: FIELD_MANAGER_ROLE,
      employee: { connect: { id: emp.id } },
    },
  });

  console.log("Created FIELD_MANAGER", user.id, "for employee", emp.id);
  console.log("Login: foreman1 / Foreman123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
