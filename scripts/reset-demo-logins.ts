import { prisma } from "../src/lib/prisma";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";

const ACCOUNTS = [
  { username: "admin", password: "Admin123!", role: "SYSTEM_MANAGER" },
  { username: "sysmgr", password: "WegoAudit123!", role: "SYSTEM_MANAGER" },
  { username: "pm1", password: "WegoAudit123!", role: "PROJECT_MANAGER" },
  { username: "pm2", password: "WegoAudit123!", role: "PROJECT_MANAGER" },
  { username: "opsmgr", password: "WegoAudit123!", role: "OPERATIONS_MANAGER" },
  { username: "fieldmgr", password: "WegoAudit123!", role: "FIELD_MANAGER" },
  { username: "foreman1", password: "Foreman123!", role: "FIELD_MANAGER" },
  { username: "driver1", password: "Driver123!", role: "TRUCK_DRIVER" },
  { username: "portal-a-mv3mjp00", password: "TestPass123!", role: "SUBCONTRACTOR" },
] as const;

async function main() {
  for (const acc of ACCOUNTS) {
    const user = await prisma.user.findFirst({
      where: { username: { equals: acc.username, mode: "insensitive" } },
    });
    if (!user) {
      console.log(`MISSING  ${acc.username}`);
      continue;
    }
    const hash = await hashPassword(acc.password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        status: "ACTIVE",
        username: acc.username,
        role: acc.role,
      },
    });
    const check = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, status: true },
    });
    const ok = check?.passwordHash
      ? await verifyPassword(acc.password, check.passwordHash)
      : false;
    console.log(
      `${ok ? "OK" : "FAIL"}  ${acc.username}  ${acc.role}  status=${check?.status}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
