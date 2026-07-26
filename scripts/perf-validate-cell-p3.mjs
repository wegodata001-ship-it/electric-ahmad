/**
 * P3 Optimization validation — PUT /api/measurement-sheets/:id/cells
 */
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || "http://localhost:3000";
const SHEET_ID = process.argv[3] || "cms1h5gb10009l604tdvjvdv2";
const PASSWORD = process.env.PERF_PASSWORD || "WegoAudit123!";
const prisma = new PrismaClient();

function ms(t0) {
  return Math.round(performance.now() - t0);
}
function avg(arr) {
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

async function main() {
  console.log("\n=== P3 Cell Save Optimization Validation ===\n");

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sysmgr", password: PASSWORD }),
  });
  if (!login.ok) throw new Error(`Login failed ${login.status}`);
  const cookie = (login.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const cell = await prisma.measurementCell.findFirst({
    where: { sheetId: SHEET_ID },
    select: { id: true, rowId: true, boqItemId: true, quantity: true },
  });
  if (!cell) throw new Error("No cell");

  const baseQty = Number(cell.quantity);
  const flipQty = baseQty + 0.001;

  const rttSamples = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    rttSamples.push(ms(t0));
  }
  const rttMin = Math.min(...rttSamples);
  const rttAvg = avg(rttSamples);

  // Repo one-shot (fuseAuth false — mirrors internal path timing of SQL)
  const user = await prisma.user.findFirst({
    where: { username: "sysmgr" },
    select: { id: true },
  });

  const repoSamples = [];
  for (let i = 0; i < 4; i++) {
    const q = i % 2 === 0 ? flipQty : baseQty;
    const cellsJson = JSON.stringify([
      {
        id: crypto.randomUUID().replace(/-/g, ""),
        entryId: crypto.randomUUID().replace(/-/g, ""),
        rowId: cell.rowId,
        boqItemId: cell.boqItemId,
        quantity: q,
      },
    ]);
    const t0 = performance.now();
    await prisma.$queryRaw`
      WITH auth AS (
        SELECT u.id AS user_id
        FROM "User" u
        LEFT JOIN "Employee" emp ON emp."userId" = u.id
        WHERE u.id = ${user.id}
          AND u."passwordHash" IS NOT NULL
          AND u.role IN (
            'PROJECT_MANAGER','OPERATIONS_MANAGER','ADMIN','SYSTEM_MANAGER','admin','מנהל מערכת'
          )
          AND (emp.id IS NULL OR (emp."isDeleted" = false AND emp.status = 'active'))
      ),
      gate AS (
        SELECT
          (SELECT user_id FROM auth LIMIT 1) AS "authUserId",
          s.id AS "sheetId",
          s.status::text AS "sheetStatus"
        FROM (SELECT 1) AS _
        LEFT JOIN "MeasurementSheet" s ON s.id = ${SHEET_ID}
      ),
      incoming AS (
        SELECT * FROM jsonb_to_recordset(CAST(${cellsJson} AS jsonb))
          AS x(id text, "entryId" text, "rowId" text, "boqItemId" text, quantity numeric)
      ),
      prepared AS (
        SELECT i.id AS proposed_id, i."entryId", i."rowId", i."boqItemId",
               i.quantity AS new_qty, c.id AS existing_id, COALESCE(c.quantity, 0) AS old_qty
        FROM incoming i
        INNER JOIN gate g ON g."authUserId" IS NOT NULL AND g."sheetId" IS NOT NULL
          AND g."sheetStatus" IN ('draft','in_progress','revision')
        LEFT JOIN "MeasurementCell" c ON c."rowId" = i."rowId" AND c."boqItemId" = i."boqItemId"
        WHERE c.id IS NULL OR c.quantity IS DISTINCT FROM i.quantity
      ),
      upserted AS (
        INSERT INTO "MeasurementCell" (id,"sheetId","rowId","boqItemId",quantity,"createdAt","updatedAt")
        SELECT COALESCE(p.existing_id, p.proposed_id), ${SHEET_ID}, p."rowId", p."boqItemId", p.new_qty, NOW(), NOW()
        FROM prepared p
        ON CONFLICT ("rowId","boqItemId") DO UPDATE
          SET quantity = EXCLUDED.quantity, "updatedAt" = NOW()
        RETURNING id
      ),
      entries AS (
        INSERT INTO "MeasurementEntry" (id,"sheetId","cellId","boqItemId","rowId","oldQuantity","newQuantity",note,"actorId","createdAt")
        SELECT p."entryId", ${SHEET_ID}, u.id, p."boqItemId", p."rowId", p.old_qty, p.new_qty, null, g."authUserId", NOW()
        FROM upserted u
        INNER JOIN prepared p ON true
        CROSS JOIN gate g
        RETURNING id
      ),
      sheet_touch AS (
        UPDATE "MeasurementSheet" s
        SET "updatedById" = g."authUserId", "updatedAt" = NOW(),
            status = CASE WHEN s.status = 'revision'::"MeasurementSheetStatus"
              THEN 'revision'::"MeasurementSheetStatus"
              ELSE 'in_progress'::"MeasurementSheetStatus" END
        FROM gate g
        WHERE s.id = ${SHEET_ID} AND EXISTS (SELECT 1 FROM upserted)
        RETURNING s.id
      )
      SELECT (SELECT COUNT(*)::int FROM upserted) AS saved FROM gate
    `;
    if (i > 0) repoSamples.push(ms(t0));
  }

  await prisma.measurementCell.update({
    where: { id: cell.id },
    data: { quantity: baseQty },
  });

  // HTTP
  const httpSamples = [];
  let bytes = 0;
  let ok = true;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const res = await fetch(
      `${BASE}/api/measurement-sheets/${SHEET_ID}/cells`,
      {
        method: "PUT",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cells: [
            {
              rowId: cell.rowId,
              boqItemId: cell.boqItemId,
              quantity: i % 2 === 0 ? flipQty : baseQty,
            },
          ],
        }),
      }
    );
    const text = await res.text();
    const elapsed = ms(t0);
    if (!res.ok) {
      ok = false;
      console.error("HTTP fail", res.status, text.slice(0, 300));
    }
    if (i > 0) httpSamples.push(elapsed);
    if (i === 1) bytes = Buffer.byteLength(text);
  }

  await prisma.measurementCell.update({
    where: { id: cell.id },
    data: { quantity: baseQty },
  });

  const before = {
    httpAvg: 2324,
    repoAvg: 1889,
    queries: "auth + sheet + prefetch + 3 tx writes ≈ 6",
    roundTrips: 6,
    payload: 35,
    source: "perf-audit-cell-p3-results.json",
  };

  const after = {
    rttMin,
    rttAvg,
    rttSamples,
    repoMin: Math.min(...repoSamples),
    repoAvg: avg(repoSamples),
    repoSamples,
    httpMin: Math.min(...httpSamples),
    httpAvg: avg(httpSamples),
    httpSamples,
    httpOk: ok,
    bytes,
    queries: 1,
    roundTrips: 1,
  };

  const httpImp = Math.round(
    ((before.httpAvg - after.httpAvg) / before.httpAvg) * 100
  );
  const repoImp = Math.round(
    ((before.repoAvg - after.repoAvg) / before.repoAvg) * 100
  );

  const inTarget = after.httpAvg >= 500 && after.httpAvg <= 900;
  const nearRtt =
    after.httpAvg <= after.rttAvg * 1.8 && after.httpMin <= after.rttMin * 2;

  const report = {
    measuredAt: new Date().toISOString(),
    sheetId: SHEET_ID,
    before,
    after,
    improvement: { httpPercent: httpImp, repoPercent: repoImp },
    stopRule: {
      targetRange: "500–900ms",
      inTarget,
      nearRttFloor: nearRtt,
      message: inTarget
        ? "STOP: HTTP in 500–900ms target — code exhausted; further gains need infra."
        : nearRtt
          ? "STOP: remaining ≈ RTT floor — no further cell-save refactor."
          : "Review samples — may need another pass if >> 2×RTT.",
    },
  };

  writeFileSync(
    new URL("./perf-validate-cell-p3-results.json", import.meta.url),
    JSON.stringify(report, null, 2)
  );

  console.log(`RTT SELECT 1     min=${rttMin} avg=${rttAvg}`);
  console.log(
    `REPO 1-shot CTE  min=${after.repoMin} avg=${after.repoAvg} samples=${repoSamples.join(",")}`
  );
  console.log(
    `HTTP batch 1cell min=${after.httpMin} avg=${after.httpAvg} samples=${httpSamples.join(",")} bytes=${bytes} ok=${ok}`
  );
  console.log(
    `\nBefore → After  HTTP ${before.httpAvg} → ${after.httpAvg} (−${httpImp}%)`
  );
  console.log(
    `                REPO ${before.repoAvg} → ${after.repoAvg} (−${repoImp}%)`
  );
  console.log(`Queries/RTT     ${before.queries} → 1`);
  console.log(`\n${report.stopRule.message}\n`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
