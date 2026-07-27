/**
 * Ensure office / project-manager login exists on current DB (no full reseed).
 * Usage: npx tsx scripts/provision-office-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { SYSTEM_MANAGER_ROLE } from "../src/lib/auth/roles";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@wego-electric.co.il";
  const username = "admin";
  const password = "Admin123!";
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  // Super Admin → System Back Office only (full width). Never Project Portal.
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        username,
        passwordHash,
        role: SYSTEM_MANAGER_ROLE,
        name: existing.name || "אדמין WEGO",
      },
    });
    console.log(`Updated SUPER ADMIN: ${username} / ${password} → ${SYSTEM_MANAGER_ROLE}`);
  } else {
    await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        name: "אדמין WEGO",
        role: SYSTEM_MANAGER_ROLE,
        avatarUrl:
          "https://api.dicebear.com/7.x/initials/svg?seed=Admin&backgroundColor=2563eb",
      },
    });
    console.log(`Created SUPER ADMIN: ${username} / ${password} → ${SYSTEM_MANAGER_ROLE}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
