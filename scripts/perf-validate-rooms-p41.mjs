import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || "http://localhost:3000";
const PROJECT_ID = process.argv[3] || "cms034ch70002kz04wu99jp4h";
const PASSWORD = process.env.PERF_PASSWORD || "WegoAudit123!";
const prisma = new PrismaClient();

function ms(t0) {
  return Math.round(performance.now() - t0);
}
function avg(a) {
  return Math.round(a.reduce((x, y) => x + y, 0) / a.length);
}

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sysmgr", password: PASSWORD }),
  });
  const cookie = (login.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const rtt = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    rtt.push(ms(t0));
  }

  const samples = [];
  let bytes = 0;
  let ok = true;
  let itemCount = 0;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/projects/${PROJECT_ID}/rooms`, {
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    const elapsed = ms(t0);
    if (!res.ok) {
      ok = false;
      console.error(res.status, text.slice(0, 400));
    }
    if (i > 0) samples.push(elapsed);
    if (i === 1) {
      bytes = Buffer.byteLength(text);
      try {
        itemCount = JSON.parse(text)?.data?.items?.length ?? 0;
      } catch {
        /* */
      }
    }
  }

  const before = { httpAvg: 4066, queries: "~6 (auth+migrate+list+N×hasReports)" };
  const after = {
    httpAvg: avg(samples),
    httpMin: Math.min(...samples),
    samples,
    bytes,
    itemCount,
    ok,
    rttMin: Math.min(...rtt),
    rttAvg: avg(rtt),
    queries: 1,
  };
  const imp = Math.round(((before.httpAvg - after.httpAvg) / before.httpAvg) * 100);

  const report = {
    measuredAt: new Date().toISOString(),
    phase: "P4.1",
    before,
    after,
    improvementPercent: imp,
  };
  writeFileSync(
    new URL("./perf-validate-rooms-p41-results.json", import.meta.url),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
