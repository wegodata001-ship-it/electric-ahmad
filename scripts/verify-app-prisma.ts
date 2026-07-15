import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("proxy aiParseLog.create:", typeof prisma.aiParseLog?.create);
  const count = await prisma.aiParseLog.count();
  console.log("count via app prisma:", count);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
