import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  console.log("aiParseLog.create typeof:", typeof prisma.aiParseLog?.create);
  const count = await prisma.aiParseLog.count();
  console.log("AiParseLog count:", count);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
