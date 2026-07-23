import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const PASSWORD = "WegoAudit123!";

const targets = [
  {
    email: "pm1.scenario@audit.local",
    name: "מנהל א",
    role: "PROJECT_MANAGER",
    username: "pm1",
  },
  {
    email: "pm2.scenario@audit.local",
    name: "מנהל ב",
    role: "PROJECT_MANAGER",
    username: "pm2",
  },
  {
    email: "sys.scenario@audit.local",
    name: "מנהל מערכת",
    role: "SYSTEM_MANAGER",
    username: "sysmgr",
  },
];

async function main() {
  const passwordHash = await hashPassword(PASSWORD);
  const out: unknown[] = [];

  for (const t of targets) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      create: {
        email: t.email,
        name: t.name,
        role: t.role,
        username: t.username,
        passwordHash,
      },
      update: {
        name: t.name,
        role: t.role,
        username: t.username,
        passwordHash,
      },
      select: { email: true, username: true, name: true, role: true },
    });
    out.push(user);
  }

  console.log(
    JSON.stringify(
      {
        password: PASSWORD,
        loginHint: "התחברות Office דרך /login עם אימייל או שם משתמש",
        users: out,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
