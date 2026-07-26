/** P1.5 after — hub HTTP + auth/me + RTT */
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || "http://localhost:3000";
const PROJECT_ID = process.argv[3] || "cms034ch70002kz04wu99jp4h";
const PASSWORD = process.env.PERF_PASSWORD || "WegoAudit123!";
const prisma = new PrismaClient();

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sysmgr", password: PASSWORD }),
  });
  const cookie = (login.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const hub = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/projects/${PROJECT_ID}/hub`, {
      headers: { Cookie: cookie },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const j = JSON.parse(buf.toString("utf8"));
    hub.push({
      ms: Math.round(performance.now() - t0),
      status: res.status,
      bytes: buf.length,
      ok: !!j.success,
      boq: j.data?.cards?.boq?.itemCount,
    });
    console.log("hub", hub[i]);
  }

  const me = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Cookie: cookie },
    });
    await res.arrayBuffer();
    me.push(Math.round(performance.now() - t0));
    console.log("me", me[i], res.status);
  }

  const rtt = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    rtt.push(Math.round(performance.now() - t0));
  }

  const out = {
    measuredAt: new Date().toISOString(),
    before: {
      hubHttpAvgMs: 1163,
      hubHttpMinMs: 1158,
      dbRoundTrips: 2,
      authMeMs: 680,
    },
    after: {
      hubSamples: hub,
      hubMinMs: Math.min(...hub.map((h) => h.ms)),
      hubAvgMs: Math.round(hub.reduce((s, h) => s + h.ms, 0) / hub.length),
      hubMaxMs: Math.max(...hub.map((h) => h.ms)),
      meSamples: me,
      meAvgMs: Math.round(me.reduce((a, b) => a + b, 0) / me.length),
      dbRoundTrips: 1,
      rttSamples: rtt,
      rttAvgMs: Math.round(rtt.reduce((a, b) => a + b, 0) / rtt.length),
      rttMinMs: Math.min(...rtt),
    },
  };
  out.improvement = {
    hubPct: Math.round(
      ((out.before.hubHttpAvgMs - out.after.hubAvgMs) /
        out.before.hubHttpAvgMs) *
        100
    ),
    under1s: out.after.hubAvgMs < 1000,
    under900ms: out.after.hubAvgMs < 900,
  };

  console.log("\n=== P1.5 AFTER ===");
  console.log(JSON.stringify({ ...out.after, improvement: out.improvement }, null, 2));

  writeFileSync(
    new URL("./perf-audit-auth-p15-after-results.json", import.meta.url),
    JSON.stringify(out, null, 2)
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
