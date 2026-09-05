/**
 * Ensure demo truck driver user exists.
 * Run: npx tsx scripts/ensure-driver-user.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { TRUCK_DRIVER_ROLE } from "../src/lib/auth/roles";

const prisma = new PrismaClient();

async function main() {
  const username = "driver1";
  const password = "Driver123!";
  const email = "driver1@opallab.local";
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });

  let userId: string;
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: TRUCK_DRIVER_ROLE,
        passwordHash,
        name: "נהג דמו",
        username,
      },
    });
    userId = existing.id;
    console.log("Updated driver user:", username);
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        username,
        name: "נהג דמו",
        role: TRUCK_DRIVER_ROLE,
        passwordHash,
      },
    });
    userId = user.id;
    console.log("Created driver user:", username);
  }

  const emp = await prisma.employee.findUnique({ where: { userId } });
  if (!emp) {
    await prisma.employee.create({
      data: {
        firstName: "נהג",
        lastName: "דמו",
        phone: "0500000000",
        email,
        role: "worker",
        status: "active",
        joinedAt: new Date(),
        userId,
      },
    });
    console.log("Linked employee for driver");
  }

  console.log(`Login: ${username} / ${password} → /driver`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
