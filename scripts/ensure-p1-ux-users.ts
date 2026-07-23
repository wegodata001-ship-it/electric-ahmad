import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const PASS = "WegoAudit123!";

async function ensure(
  username: string,
  email: string,
  name: string,
  role: string,
  linkEmployee = false
) {
  const passwordHash = await hash(PASS, 10);
  let user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    include: { employee: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        username,
        email,
        name,
        role,
        passwordHash,
      },
      include: { employee: true },
    });
    console.log("CREATED", username, role);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, role, username },
    });
    console.log("UPDATED", username, role);
  }

  if (linkEmployee) {
    const existing = await prisma.employee.findFirst({
      where: { userId: user.id },
    });
    if (!existing) {
      const emp =
        (await prisma.employee.findFirst({
          where: { isDeleted: false, status: "active", userId: null },
        })) ||
        (await prisma.employee.findFirst({
          where: { isDeleted: false, status: "active" },
        }));
      if (emp) {
        await prisma.employee.update({
          where: { id: emp.id },
          data: { userId: user.id },
        });
        console.log("LINKED employee", emp.id, "→", username);
      } else {
        console.log("NO_EMP for", username);
      }
    }
  }
}

async function main() {
  await ensure("sysmgr", "sys.scenario@audit.local", "System Manager", "SYSTEM_MANAGER");
  await ensure("pm1", "pm1.scenario@audit.local", "PM One", "PROJECT_MANAGER");
  await ensure("opsmgr", "ops.scenario@audit.local", "Ops Manager", "OPERATIONS_MANAGER");
  await ensure(
    "fieldmgr",
    "field.ux@audit.local",
    "Field Manager UX",
    "FIELD_MANAGER",
    true
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
