/**
 * P1 validation — hub HTTP + repository round-trip count estimate.
 */
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || "http://localhost:3000";
const PROJECT_ID = process.argv[3] || "cms034ch70002kz04wu99jp4h";
const PASSWORD = process.env.PERF_PASSWORD || "WegoAudit123!";
const prisma = new PrismaClient();

async function loginCookie() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sysmgr", password: PASSWORD }),
  });
  return (res.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function main() {
  const cookie = await loginCookie();
  const http = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/projects/${PROJECT_ID}/hub`, {
      headers: { Cookie: cookie },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const j = JSON.parse(buf.toString("utf8"));
    http.push({
      ms: Math.round(performance.now() - t0),
      status: res.status,
      bytes: buf.length,
      ok: !!j.success,
      boq: j.data?.cards?.boq?.itemCount,
      sheets: j.data?.cards?.performance?.sheetCount,
      invoices: j.data?.cards?.invoices?.total,
      items: j.data?.cards?.invoices?.items?.length,
    });
    console.log(`HTTP #${i + 1}`, http[i]);
  }

  // Repo-only: one $queryRaw shaped like the new hub (same SQL skeleton timing)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const repo = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const rows = await prisma.$queryRaw`
      WITH boq AS (
        SELECT COUNT(*)::int AS item_count
        FROM "BoqItem"
        WHERE "projectId" = ${PROJECT_ID} AND "deletedAt" IS NULL
      ),
      sheets AS (
        SELECT COUNT(*)::int AS sheet_count
        FROM "MeasurementSheet" WHERE "projectId" = ${PROJECT_ID}
      ),
      cells AS (
        SELECT COUNT(*)::int AS cell_count
        FROM "MeasurementCell" c
        INNER JOIN "MeasurementSheet" s ON s.id = c."sheetId"
        WHERE s."projectId" = ${PROJECT_ID}
      ),
      entries AS (
        SELECT COUNT(*)::int AS entry_count, MAX(e."createdAt") AS last_entry_at
        FROM "MeasurementEntry" e
        INNER JOIN "MeasurementSheet" s ON s.id = e."sheetId"
        WHERE s."projectId" = ${PROJECT_ID}
      ),
      inv AS (
        SELECT COUNT(*)::int AS total FROM "PartialInvoice" WHERE "projectId" = ${PROJECT_ID}
      ),
      inv_items AS (
        SELECT COALESCE(json_agg(x.*), '[]'::json) AS items FROM (
          SELECT id FROM "PartialInvoice" WHERE "projectId" = ${PROJECT_ID}
          ORDER BY "sequenceNumber" DESC LIMIT 8
        ) x
      ),
      docs AS (
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE "createdAt" >= ${weekAgo})::int AS recent
        FROM "Document" WHERE "projectId" = ${PROJECT_ID}
      ),
      diaries AS (
        SELECT COUNT(*)::int AS total, MAX("workDate") AS last_at
        FROM "WorkDiary" WHERE "projectId" = ${PROJECT_ID} AND "deletedAt" IS NULL
      ),
      deliveries AS (
        SELECT COUNT(*)::int AS total FROM "OpsDeliveryNote"
        WHERE "projectId" = ${PROJECT_ID} AND "deletedAt" IS NULL
      ),
      rooms AS (
        SELECT COUNT(*)::int AS unit_count FROM "ProjectRoom"
        WHERE "projectId" = ${PROJECT_ID} AND "deletedAt" IS NULL AND "isHidden" = false
      )
      SELECT p.id, boq.item_count, sheets.sheet_count, inv.total, docs.total, rooms.unit_count
      FROM "Project" p
      CROSS JOIN boq CROSS JOIN sheets CROSS JOIN cells CROSS JOIN entries
      CROSS JOIN inv CROSS JOIN inv_items CROSS JOIN docs CROSS JOIN diaries
      CROSS JOIN deliveries CROSS JOIN rooms
      WHERE p.id = ${PROJECT_ID}
    `;
    repo.push({ ms: Math.round(performance.now() - t0), rows: rows.length });
    console.log(`REPO #${i + 1}`, repo[i]);
  }

  const baseline = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    baseline.push(Math.round(performance.now() - t0));
  }

  const out = {
    measuredAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    before: {
      httpWarmMs: 2302,
      repoQueries: 14,
      authQueries: 1,
      totalDbRoundTrips: 15,
      repoWallMs: 1632,
      select1Ms: 434,
    },
    after: {
      httpSamples: http,
      httpWarmMs: http[http.length - 1]?.ms,
      httpMinMs: Math.min(...http.map((h) => h.ms)),
      httpAvgMs: Math.round(http.reduce((s, h) => s + h.ms, 0) / http.length),
      repoSamples: repo,
      repoMinMs: Math.min(...repo.map((r) => r.ms)),
      repoAvgMs: Math.round(repo.reduce((s, r) => s + r.ms, 0) / repo.length),
      repoQueries: 1,
      authQueries: 1,
      totalDbRoundTrips: 2,
      select1Samples: baseline,
      select1AvgMs: Math.round(baseline.reduce((a, b) => a + b, 0) / baseline.length),
    },
  };

  const httpImp = Math.round(
    ((out.before.httpWarmMs - out.after.httpWarmMs) / out.before.httpWarmMs) * 100
  );
  const repoImp = Math.round(
    ((out.before.repoWallMs - out.after.repoAvgMs) / out.before.repoWallMs) * 100
  );
  out.improvement = {
    httpPct: httpImp,
    repoPct: repoImp,
    roundTripsBefore: 15,
    roundTripsAfter: 2,
  };

  console.log("\n=== P1 RESULT ===");
  console.log(JSON.stringify(out.improvement, null, 2));
  console.log(
    `HTTP before ${out.before.httpWarmMs}ms → after warm ${out.after.httpWarmMs}ms (min ${out.after.httpMinMs}, avg ${out.after.httpAvgMs})`
  );
  console.log(
    `REPO before ${out.before.repoWallMs}ms → after avg ${out.after.repoAvgMs}ms (min ${out.after.repoMinMs})`
  );
  console.log(
    `Round trips ${out.improvement.roundTripsBefore} → ${out.improvement.roundTripsAfter}`
  );

  writeFileSync(
    new URL("./perf-audit-hub-p1-after-results.json", import.meta.url),
    JSON.stringify(out, null, 2)
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
