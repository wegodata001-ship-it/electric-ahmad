import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const result = await prisma.user.updateMany({
  where: {
    OR: [
      { username: "admin" },
      { email: "admin@wego-electric.co.il" },
      { name: "אדמין WEGO" },
    ],
  },
  data: { role: "SYSTEM_MANAGER" },
});

console.log("updated", result.count);
const rows = await prisma.user.findMany({
  where: { OR: [{ username: "admin" }, { username: "sysmgr" }] },
  select: { username: true, role: true, name: true },
});
console.log(rows);
await prisma.$disconnect();
