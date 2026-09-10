import { prisma } from "../src/lib/prisma";

async function main() {
  const samples: number[] = [];
  for (let i = 0; i < 8; i++) {
    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    samples.push(Math.round(performance.now() - t0));
  }

  const t1 = performance.now();
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1`;
    await tx.$queryRaw`SELECT 1`;
    await tx.$queryRaw`SELECT 1`;
    await tx.$queryRaw`SELECT 1`;
    await tx.$queryRaw`SELECT 1`;
  });
  const interactive5 = Math.round(performance.now() - t1);

  const t2 = performance.now();
  await prisma.$executeRaw`
    WITH a AS (SELECT 1 AS x),
    b AS (SELECT x FROM a),
    c AS (SELECT x FROM b),
    d AS (SELECT x FROM c),
    e AS (SELECT x FROM d)
    SELECT * FROM e
  `;
  const singleCte = Math.round(performance.now() - t2);

  const sorted = [...samples].sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        select1SamplesMs: samples,
        select1MedianMs: sorted[Math.floor(sorted.length / 2)],
        select1MinMs: sorted[0],
        select1MaxMs: sorted[sorted.length - 1],
        interactiveTx5SelectsMs: interactive5,
        singleCte5StepsMs: singleCte,
        databaseHost: "aws-0-eu-north-1.pooler.supabase.com",
        databaseRegion: "eu-north-1",
        pooler: "Supabase PgBouncer :6543",
        appRuntime: "local (bench machine)",
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
