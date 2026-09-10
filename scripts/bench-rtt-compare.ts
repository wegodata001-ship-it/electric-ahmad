import { prisma } from "../src/lib/prisma";

async function main() {
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    times.push(Math.round(performance.now() - t0));
  }
  const tTx0 = performance.now();
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < 5; i++) {
      await tx.$queryRaw`SELECT 1`;
    }
  });
  const txMs = Math.round(performance.now() - tTx0);
  const tCte0 = performance.now();
  await prisma.$queryRaw`
    WITH a AS (SELECT 1 AS x),
         b AS (SELECT x FROM a),
         c AS (SELECT x FROM b),
         d AS (SELECT x FROM c),
         e AS (SELECT x FROM d)
    SELECT * FROM e
  `;
  const cteMs = Math.round(performance.now() - tCte0);
  console.log(
    JSON.stringify({
      select1: times,
      select1Median: [...times].sort((a, b) => a - b)[2],
      interactiveTx5: txMs,
      singleCte5: cteMs,
      dbHost: "aws-0-eu-north-1.pooler.supabase.com",
      poolerPort: 6543,
      appRuntime: "local-dev-machine",
      vercelRegionPinned: false,
    })
  );
  await prisma.$disconnect();
}

main();
