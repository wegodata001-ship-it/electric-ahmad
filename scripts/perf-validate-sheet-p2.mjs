/**
 * P2 Optimization validation — GET /api/measurement-sheets/:id
 * Before (audit) vs After (CTE + fused auth).
 */
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || "http://localhost:3000";
const PROJECT_ID = process.argv[3] || "cms034ch70002kz04wu99jp4h";
const SHEET_ID = process.argv[4] || "cms1h5gb10009l604tdvjvdv2";
const PASSWORD = process.env.PERF_PASSWORD || "WegoAudit123!";
const prisma = new PrismaClient();

function ms(t0) {
  return Math.round(performance.now() - t0);
}

function avg(arr) {
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

async function main() {
  console.log("\n=== P2 Measurement Sheet Optimization Validation ===");
  console.log(`sheet=${SHEET_ID} base=${BASE}\n`);

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sysmgr", password: PASSWORD }),
  });
  if (!login.ok) {
    throw new Error(`Login failed: ${login.status}`);
  }
  const cookie = (login.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const rttSamples = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    rttSamples.push(ms(t0));
  }
  const rttMin = Math.min(...rttSamples);
  const rttAvg = avg(rttSamples);

  // Repo CTE (no auth) — mirrors getById
  const cteSql = `
    WITH base AS (
      SELECT s.id
      FROM "MeasurementSheet" s
      WHERE s.id = $1
    ),
    rows_agg AS (
      SELECT COALESCE(json_agg(json_build_object('id', r.id)), '[]'::json) AS rows
      FROM "MeasurementSheetRow" r WHERE r."sheetId" = $1
    ),
    cells_agg AS (
      SELECT COALESCE(json_agg(json_build_object(
        'id', c.id, 'quantity', c.quantity,
        'boqItem', json_build_object('id', b.id, 'code', b.code)
      )), '[]'::json) AS cells
      FROM "MeasurementCell" c
      LEFT JOIN "BoqItem" b ON b.id = c."boqItemId"
      WHERE c."sheetId" = $1
    ),
    approvals_agg AS (
      SELECT COALESCE(json_agg(json_build_object('id', a.id)), '[]'::json) AS approvals
      FROM "MeasurementSheetApproval" a WHERE a."sheetId" = $1
    ),
    notes_agg AS (
      SELECT COALESCE(json_agg(json_build_object('id', n.id)), '[]'::json) AS notes
      FROM "MeasurementSheetReviewNote" n WHERE n."sheetId" = $1
    ),
    events_agg AS (
      SELECT COALESCE(json_agg(json_build_object('id', e.id)), '[]'::json) AS events
      FROM (
        SELECT id FROM "MeasurementSheetEvent" WHERE "sheetId" = $1
        ORDER BY "createdAt" DESC LIMIT 40
      ) e
    ),
    versions_agg AS (
      SELECT COALESCE(json_agg(json_build_object('id', v.id, 'version', v.version)), '[]'::json) AS versions
      FROM (
        SELECT id, version FROM "MeasurementSheetVersion" WHERE "sheetId" = $1
        ORDER BY version DESC LIMIT 20
      ) v
    )
    SELECT b.id, r.rows, c.cells, a.approvals, n.notes, e.events, v.versions
    FROM base b
    CROSS JOIN rows_agg r
    CROSS JOIN cells_agg c
    CROSS JOIN approvals_agg a
    CROSS JOIN notes_agg n
    CROSS JOIN events_agg e
    CROSS JOIN versions_agg v
  `;

  // Warm + sample full CTE like production (with joins for project/user)
  const fullCteSamples = [];
  let payloadBytes = 0;
  let cellCount = 0;
  for (let i = 0; i < 4; i++) {
    const t0 = performance.now();
    const rows = await prisma.$queryRawUnsafe(
      `WITH auth AS (
         SELECT u.id AS user_id FROM "User" u
         WHERE u.username = 'sysmgr' AND u."passwordHash" IS NOT NULL LIMIT 1
       ),
       base AS (
         SELECT s.*, 
           json_build_object('id', p.id, 'name', p.name) AS project,
           json_build_object('id', cu.id, 'name', cu.name) AS "createdBy",
           (SELECT user_id FROM auth) AS "authUserId"
         FROM "MeasurementSheet" s
         INNER JOIN "Project" p ON p.id = s."projectId"
         INNER JOIN "User" cu ON cu.id = s."createdById"
         WHERE s.id = $1
       ),
       rows_agg AS (
         SELECT COALESCE(json_agg(json_build_object(
           'id', r.id, 'name', r.name, 'sortOrder', r."sortOrder",
           'projectRoom', CASE WHEN pr.id IS NULL THEN NULL ELSE json_build_object(
             'id', pr.id, 'name', pr.name, 'sortOrder', pr."sortOrder",
             'isHidden', pr."isHidden", 'deletedAt', pr."deletedAt"
           ) END
         ) ORDER BY COALESCE(pr."sortOrder", r."sortOrder")), '[]'::json) AS rows
         FROM "MeasurementSheetRow" r
         LEFT JOIN "ProjectRoom" pr ON pr.id = r."projectRoomId"
         WHERE r."sheetId" = $1
       ),
       cells_agg AS (
         SELECT COALESCE(json_agg(json_build_object(
           'id', c.id, 'rowId', c."rowId", 'boqItemId', c."boqItemId",
           'quantity', c.quantity,
           'boqItem', CASE WHEN b.id IS NULL THEN NULL ELSE json_build_object(
             'id', b.id, 'code', b.code, 'description', b.description,
             'unit', b.unit, 'contractQuantity', b."contractQuantity",
             'completedQuantity', b."completedQuantity", 'unitPrice', b."unitPrice",
             'invoicedQuantity', b."invoicedQuantity", 'remainingQuantity', b."remainingQuantity",
             'deletedAt', b."deletedAt"
           ) END
         )), '[]'::json) AS cells
         FROM "MeasurementCell" c
         LEFT JOIN "BoqItem" b ON b.id = c."boqItemId"
         WHERE c."sheetId" = $1
       ),
       approvals_agg AS (
         SELECT COALESCE(json_agg(json_build_object('id', a.id)), '[]'::json) AS approvals
         FROM "MeasurementSheetApproval" a WHERE a."sheetId" = $1
       ),
       notes_agg AS (
         SELECT COALESCE(json_agg(json_build_object('id', n.id)), '[]'::json) AS "reviewNotes"
         FROM "MeasurementSheetReviewNote" n WHERE n."sheetId" = $1
       ),
       events_agg AS (
         SELECT COALESCE(json_agg(json_build_object('id', e.id)), '[]'::json) AS events
         FROM (
           SELECT id FROM "MeasurementSheetEvent" WHERE "sheetId" = $1
           ORDER BY "createdAt" DESC LIMIT 40
         ) e
       ),
       versions_agg AS (
         SELECT COALESCE(json_agg(json_build_object(
           'id', v.id, 'version', v.version, 'status', v.status, 'note', v.note, 'createdAt', v."createdAt"
         ) ORDER BY v.version DESC), '[]'::json) AS versions
         FROM (
           SELECT id, version, status, note, "createdAt"
           FROM "MeasurementSheetVersion" WHERE "sheetId" = $1
           ORDER BY version DESC LIMIT 20
         ) v
       )
       SELECT b.*, r.rows, c.cells, a.approvals, n."reviewNotes", e.events, v.versions
       FROM base b
       CROSS JOIN rows_agg r CROSS JOIN cells_agg c CROSS JOIN approvals_agg a
       CROSS JOIN notes_agg n CROSS JOIN events_agg e CROSS JOIN versions_agg v`,
      SHEET_ID
    );
    const elapsed = ms(t0);
    if (i > 0) fullCteSamples.push(elapsed);
    if (i === 1) {
      const row = rows[0];
      const cells = Array.isArray(row?.cells)
        ? row.cells
        : JSON.parse(row?.cells || "[]");
      cellCount = cells.length;
      payloadBytes = Buffer.byteLength(JSON.stringify(row));
    }
  }

  // HTTP GET sheet
  const httpSamples = [];
  let httpBytes = 0;
  let httpOk = true;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/measurement-sheets/${SHEET_ID}`, {
      headers: { Cookie: cookie },
    });
    const body = await res.text();
    const elapsed = ms(t0);
    if (!res.ok) {
      httpOk = false;
      console.error("HTTP fail", res.status, body.slice(0, 300));
    }
    if (i > 0) httpSamples.push(elapsed);
    if (i === 1) httpBytes = Buffer.byteLength(body);
  }

  const before = {
    httpAvg: 3222,
    httpMin: null,
    repoIncludeAvg: 2182,
    authRtt: 623,
    roundTrips: "auth + Prisma fan-out (multi)",
    notes: "From perf-audit-sheet-p2-results.json",
  };

  const after = {
    rttMin,
    rttAvg,
    rttSamples,
    repoCteMin: Math.min(...fullCteSamples),
    repoCteAvg: avg(fullCteSamples),
    repoCteSamples: fullCteSamples,
    httpMin: Math.min(...httpSamples),
    httpAvg: avg(httpSamples),
    httpSamples,
    httpOk,
    httpBytes,
    payloadBytes,
    cellCount,
    roundTrips: "1 (HMAC + fused auth CTE)",
  };

  const httpImprovement = Math.round(
    ((before.httpAvg - after.httpAvg) / before.httpAvg) * 100
  );
  const repoImprovement = Math.round(
    ((before.repoIncludeAvg - after.repoCteAvg) / before.repoIncludeAvg) * 100
  );

  const infraFloor =
    after.httpAvg <= after.rttAvg * 1.35 &&
    after.httpAvg - after.rttMin < after.rttAvg * 0.5;

  const report = {
    measuredAt: new Date().toISOString(),
    sheetId: SHEET_ID,
    projectId: PROJECT_ID,
    before,
    after,
    improvement: {
      httpPercent: httpImprovement,
      repoPercent: repoImprovement,
    },
    stopRule: {
      remainingNearRtt: infraFloor,
      message: infraFloor
        ? "STOP: remaining latency ≈ infrastructure RTT — no further sheet-load refactor."
        : "Room may remain if HTTP still >> 1×RTT; inspect samples.",
    },
  };

  writeFileSync(
    new URL("./perf-validate-sheet-p2-results.json", import.meta.url),
    JSON.stringify(report, null, 2)
  );

  console.log("\n--- Results ---\n");
  console.log(`RTT SELECT 1     min=${rttMin}ms  avg=${rttAvg}ms`);
  console.log(
    `REPO CTE         min=${after.repoCteMin}ms  avg=${after.repoCteAvg}ms  samples=${fullCteSamples.join(",")}`
  );
  console.log(
    `HTTP GET sheet   min=${after.httpMin}ms  avg=${after.httpAvg}ms  samples=${httpSamples.join(",")}`
  );
  console.log(`Payload          http=${httpBytes}B  repoRow≈${payloadBytes}B  cells=${cellCount}`);
  console.log(`Round trips      ${after.roundTrips}`);
  console.log(
    `\nBefore → After   HTTP ${before.httpAvg} → ${after.httpAvg} (${httpImprovement}%)`
  );
  console.log(
    `                 REPO ${before.repoIncludeAvg} → ${after.repoCteAvg} (${repoImprovement}%)`
  );
  console.log(`\n${report.stopRule.message}`);
  console.log("\nWrote scripts/perf-validate-sheet-p2-results.json\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
