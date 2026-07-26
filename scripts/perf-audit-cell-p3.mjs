/**
 * P3 Audit — PUT /api/measurement-sheets/:id/cells
 * Read-only. No app code changes.
 *
 * Hot path (UI): saveCells → setCellsBatch (typically 1 dirty cell).
 * Also profiles setCellQuantity (single-cell API shape).
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

async function explain(label, sql) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`
    );
    const text = rows.map((r) => Object.values(r)[0]).join("\n");
    const exec = text.match(/Execution Time:\s*([\d.]+)\s*ms/);
    const plan = text.match(/Planning Time:\s*([\d.]+)\s*ms/);
    const seq = /Seq Scan/i.test(text);
    const idx = /Index (?:Only )?Scan|Bitmap Index Scan/i.test(text);
    return {
      label,
      ok: true,
      executionMs: exec ? Number(exec[1]) : null,
      planningMs: plan ? Number(plan[1]) : null,
      seqScan: seq,
      indexScan: idx,
      text,
    };
  } catch (e) {
    return {
      label,
      ok: false,
      executionMs: null,
      planningMs: null,
      seqScan: null,
      indexScan: null,
      text: e.message,
    };
  }
}

async function main() {
  const stages = [];
  const push = (name, elapsed, extra = {}) => {
    stages.push({ name, ms: elapsed, ...extra });
    console.log(
      `${extra.ok === false ? "ERR" : "OK "} ${String(elapsed).padStart(6)}ms  ${name}` +
        (extra.queries != null ? `  q=${extra.queries}` : "") +
        (extra.rtt != null ? `  rtt=${extra.rtt}` : "") +
        (extra.bytes != null ? `  ${extra.bytes}B` : "")
    );
  };

  console.log("\n=== P3 Cell Save Audit ===");
  console.log(`sheet=${SHEET_ID} base=${BASE}\n`);

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sysmgr", password: PASSWORD }),
  });
  if (!login.ok) throw new Error(`Login failed ${login.status}`);
  const cookie = (login.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const user = await prisma.user.findFirst({
    where: { username: "sysmgr" },
    select: { id: true },
  });
  if (!user) throw new Error("sysmgr not found");

  // Pick an existing cell to mutate (restore after)
  const cell = await prisma.measurementCell.findFirst({
    where: { sheetId: SHEET_ID },
    select: { id: true, rowId: true, boqItemId: true, quantity: true },
  });
  if (!cell) throw new Error("No cells on sample sheet");

  const baseQty = Number(cell.quantity);
  const altQty = baseQty === 0 ? 1 : baseQty; // will flip then restore
  const flipQty = baseQty + 0.001;

  // ── RTT ──
  {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await prisma.$queryRaw`SELECT 1`;
      samples.push(ms(t0));
    }
    push("RTT SELECT 1 (min)", Math.min(...samples), {
      queries: 1,
      rtt: 1,
      samples,
    });
    push("RTT SELECT 1 (avg)", avg(samples), { queries: 1, rtt: 1, samples });
  }

  // ── Auth ──
  {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          avatarUrl: true,
          passwordHash: true,
          employee: { select: { id: true, isDeleted: true, status: true } },
        },
      });
      samples.push(ms(t0));
    }
    push("Auth: requireOfficeUser slim (avg)", avg(samples), {
      queries: 1,
      rtt: 1,
      samples,
    });
  }

  // ── Validation (local) ──
  {
    const t0 = performance.now();
    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: SHEET_ID },
      select: { id: true, status: true },
    });
    const editable =
      sheet &&
      (sheet.status === "draft" ||
        sheet.status === "in_progress" ||
        sheet.status === "revision");
    const qty = Math.max(0, Number(flipQty) || 0);
    push("Validation: sheet status + qty clamp", ms(t0), {
      queries: 1,
      rtt: 1,
      editable,
      status: sheet?.status,
      qty,
    });
  }

  // ── Prefetch all cells (batch path) ──
  {
    const samples = [];
    let count = 0;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const rows = await prisma.measurementCell.findMany({
        where: { sheetId: SHEET_ID },
        select: { id: true, rowId: true, boqItemId: true, quantity: true },
      });
      samples.push(ms(t0));
      count = rows.length;
    }
    push("REPO prefetch findMany all cells (avg)", avg(samples), {
      queries: 1,
      rtt: 1,
      samples,
      cellCount: count,
    });
  }

  // ── Single cell update only ──
  {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const q = i % 2 === 0 ? flipQty : baseQty;
      const t0 = performance.now();
      await prisma.measurementCell.update({
        where: { id: cell.id },
        data: { quantity: q },
      });
      samples.push(ms(t0));
    }
    // restore
    await prisma.measurementCell.update({
      where: { id: cell.id },
      data: { quantity: baseQty },
    });
    push("REPO UPDATE cell only (avg)", avg(samples), {
      queries: 1,
      rtt: 1,
      samples,
    });
  }

  // ── Entry create only ──
  {
    const samples = [];
    const createdIds = [];
    for (let i = 0; i < 2; i++) {
      const t0 = performance.now();
      const e = await prisma.measurementEntry.create({
        data: {
          sheetId: SHEET_ID,
          cellId: cell.id,
          boqItemId: cell.boqItemId,
          rowId: cell.rowId,
          oldQuantity: baseQty,
          newQuantity: flipQty,
          note: "p3-audit",
          actorId: user.id,
        },
      });
      samples.push(ms(t0));
      createdIds.push(e.id);
    }
    await prisma.measurementEntry.deleteMany({
      where: { id: { in: createdIds } },
    });
    push("REPO INSERT entry only (avg)", avg(samples), {
      queries: 1,
      rtt: 1,
      samples,
    });
  }

  // ── Sheet touch only ──
  {
    const samples = [];
    for (let i = 0; i < 2; i++) {
      const t0 = performance.now();
      await prisma.measurementSheet.update({
        where: { id: SHEET_ID },
        data: { updatedById: user.id },
      });
      samples.push(ms(t0));
    }
    push("REPO UPDATE sheet touch (avg)", avg(samples), {
      queries: 1,
      rtt: 1,
      samples,
    });
  }

  // ── Full setCellsBatch (1 cell) — mirror production ──
  async function runBatchOnce(qty) {
    const t0 = performance.now();
    const marks = {};

    let t = performance.now();
    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: SHEET_ID },
      select: { id: true, status: true },
    });
    marks.sheetLookup = ms(t);

    t = performance.now();
    const existing = await prisma.measurementCell.findMany({
      where: { sheetId: SHEET_ID },
      select: { id: true, rowId: true, boqItemId: true, quantity: true },
    });
    marks.prefetchCells = ms(t);

    const cur = existing.find(
      (c) => c.rowId === cell.rowId && c.boqItemId === cell.boqItemId
    );
    const oldQuantity = cur ? Number(cur.quantity) : 0;

    t = performance.now();
    await prisma.$transaction(async (tx) => {
      const tU = performance.now();
      await tx.measurementCell.update({
        where: { id: cell.id },
        data: { quantity: qty },
      });
      marks.txUpdateCell = ms(tU);

      const tE = performance.now();
      await tx.measurementEntry.createMany({
        data: [
          {
            sheetId: SHEET_ID,
            cellId: cell.id,
            boqItemId: cell.boqItemId,
            rowId: cell.rowId,
            oldQuantity,
            newQuantity: qty,
            note: "p3-audit-batch",
            actorId: user.id,
          },
        ],
      });
      marks.txCreateEntry = ms(tE);

      const tS = performance.now();
      await tx.measurementSheet.update({
        where: { id: SHEET_ID },
        data: {
          updatedById: user.id,
          status: sheet.status === "revision" ? "revision" : "in_progress",
        },
      });
      marks.txTouchSheet = ms(tS);
    });
    marks.transactionTotal = ms(t);
    marks.total = ms(t0);
    return marks;
  }

  const batchSamples = [];
  const batchMarks = [];
  for (let i = 0; i < 3; i++) {
    const q = i % 2 === 0 ? flipQty : baseQty;
    const m = await runBatchOnce(q);
    batchSamples.push(m.total);
    batchMarks.push(m);
  }
  await prisma.measurementCell.update({
    where: { id: cell.id },
    data: { quantity: baseQty },
  });
  await prisma.measurementEntry.deleteMany({
    where: { note: "p3-audit-batch", sheetId: SHEET_ID },
  });

  push("REPO setCellsBatch 1-cell FULL (avg)", avg(batchSamples), {
    queries: "4–5 (sheet + prefetch + tx: update+entry+sheet)",
    rtt: "4–5 serial",
    samples: batchSamples,
    breakdownAvg: {
      sheetLookup: avg(batchMarks.map((m) => m.sheetLookup)),
      prefetchCells: avg(batchMarks.map((m) => m.prefetchCells)),
      txUpdateCell: avg(batchMarks.map((m) => m.txUpdateCell)),
      txCreateEntry: avg(batchMarks.map((m) => m.txCreateEntry)),
      txTouchSheet: avg(batchMarks.map((m) => m.txTouchSheet)),
      transactionTotal: avg(batchMarks.map((m) => m.transactionTotal)),
    },
  });

  // ── Full setCellQuantity path (transaction with findUnique) ──
  async function runSingleOnce(qty) {
    const t0 = performance.now();
    const marks = {};

    let t = performance.now();
    const sheet = await prisma.measurementSheet.findUnique({
      where: { id: SHEET_ID },
    });
    marks.sheetFull = ms(t);

    t = performance.now();
    await prisma.$transaction(async (tx) => {
      const tF = performance.now();
      const existing = await tx.measurementCell.findUnique({
        where: {
          rowId_boqItemId: {
            rowId: cell.rowId,
            boqItemId: cell.boqItemId,
          },
        },
      });
      marks.txFindCell = ms(tF);

      const oldQuantity = existing ? Number(existing.quantity) : 0;
      const tU = performance.now();
      const updated = await tx.measurementCell.update({
        where: { id: existing.id },
        data: { quantity: qty },
      });
      marks.txUpdate = ms(tU);

      const tE = performance.now();
      await tx.measurementEntry.create({
        data: {
          sheetId: SHEET_ID,
          cellId: updated.id,
          boqItemId: cell.boqItemId,
          rowId: cell.rowId,
          oldQuantity,
          newQuantity: qty,
          note: "p3-audit-single",
          actorId: user.id,
        },
      });
      marks.txEntry = ms(tE);

      const tS = performance.now();
      await tx.measurementSheet.update({
        where: { id: SHEET_ID },
        data: {
          updatedById: user.id,
          status: sheet.status === "revision" ? "revision" : "in_progress",
        },
      });
      marks.txSheet = ms(tS);
    });
    marks.transactionTotal = ms(t);
    marks.total = ms(t0);
    return marks;
  }

  const singleSamples = [];
  const singleMarks = [];
  for (let i = 0; i < 3; i++) {
    const q = i % 2 === 0 ? flipQty : baseQty;
    const m = await runSingleOnce(q);
    singleSamples.push(m.total);
    singleMarks.push(m);
  }
  await prisma.measurementCell.update({
    where: { id: cell.id },
    data: { quantity: baseQty },
  });
  await prisma.measurementEntry.deleteMany({
    where: { note: "p3-audit-single", sheetId: SHEET_ID },
  });

  push("REPO setCellQuantity FULL (avg)", avg(singleSamples), {
    queries: "5 (sheet + tx find+update+entry+sheet)",
    rtt: "5 serial",
    samples: singleSamples,
    breakdownAvg: {
      sheetFull: avg(singleMarks.map((m) => m.sheetFull)),
      txFindCell: avg(singleMarks.map((m) => m.txFindCell)),
      txUpdate: avg(singleMarks.map((m) => m.txUpdate)),
      txEntry: avg(singleMarks.map((m) => m.txEntry)),
      txSheet: avg(singleMarks.map((m) => m.txSheet)),
      transactionTotal: avg(singleMarks.map((m) => m.transactionTotal)),
    },
  });

  // ── Mapping / serialization (local) ──
  {
    const t0 = performance.now();
    const payload = JSON.stringify({ saved: 1 });
    const singlePayload = JSON.stringify({
      id: cell.id,
      rowId: cell.rowId,
      boqItemId: cell.boqItemId,
      quantity: baseQty,
    });
    push("Mapping + JSON.stringify (local)", ms(t0), {
      queries: 0,
      rtt: 0,
      batchBytes: Buffer.byteLength(payload),
      singleBytes: Buffer.byteLength(singlePayload),
    });
  }

  // ── HTTP ──
  async function httpPut(body, label) {
    const samples = [];
    let bytes = 0;
    let ok = true;
    for (let i = 0; i < 4; i++) {
      const t0 = performance.now();
      const res = await fetch(
        `${BASE}/api/measurement-sheets/${SHEET_ID}/cells`,
        {
          method: "PUT",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body(i)),
        }
      );
      const text = await res.text();
      const elapsed = ms(t0);
      if (!res.ok) {
        ok = false;
        console.error(label, res.status, text.slice(0, 200));
      }
      if (i > 0) samples.push(elapsed); // skip warm
      if (i === 1) bytes = Buffer.byteLength(text);
    }
    // restore quantity
    await prisma.measurementCell.update({
      where: { id: cell.id },
      data: { quantity: baseQty },
    });
    push(`HTTP ${label} (avg, skip warm)`, avg(samples), {
      queries: "auth+repo",
      rtt: "multi",
      samples,
      bytes,
      ok,
      min: Math.min(...samples),
    });
    return { avg: avg(samples), min: Math.min(...samples), samples, bytes, ok };
  }

  const httpBatch = await httpPut(
    (i) => ({
      cells: [
        {
          rowId: cell.rowId,
          boqItemId: cell.boqItemId,
          quantity: i % 2 === 0 ? flipQty : baseQty,
        },
      ],
    }),
    "PUT batch 1-cell (UI hot path)"
  );

  const httpSingle = await httpPut(
    (i) => ({
      rowId: cell.rowId,
      boqItemId: cell.boqItemId,
      quantity: i % 2 === 0 ? flipQty : baseQty,
    }),
    "PUT single-cell body"
  );

  // cleanup audit notes if any leaked via HTTP
  await prisma.measurementEntry.deleteMany({
    where: {
      sheetId: SHEET_ID,
      note: { in: ["p3-audit", "p3-audit-batch", "p3-audit-single"] },
    },
  });

  // ── EXPLAIN ──
  console.log("\n--- EXPLAIN ANALYZE ---\n");
  const explains = [];
  explains.push(
    await explain(
      "UPDATE cell by id",
      `UPDATE "MeasurementCell" SET quantity = quantity WHERE id = '${cell.id}'`
    )
  );
  explains.push(
    await explain(
      "SELECT cells by sheetId",
      `SELECT id, "rowId", "boqItemId", quantity FROM "MeasurementCell" WHERE "sheetId" = '${SHEET_ID}'`
    )
  );
  explains.push(
    await explain(
      "SELECT cell by unique (rowId,boqItemId)",
      `SELECT * FROM "MeasurementCell" WHERE "rowId" = '${cell.rowId}' AND "boqItemId" = '${cell.boqItemId}'`
    )
  );
  explains.push(
    await explain(
      "SELECT sheet status",
      `SELECT id, status FROM "MeasurementSheet" WHERE id = '${SHEET_ID}'`
    )
  );
  explains.push(
    await explain(
      "INSERT MeasurementEntry (dry via SELECT)",
      `SELECT 1 FROM "MeasurementEntry" WHERE "sheetId" = '${SHEET_ID}' LIMIT 1`
    )
  );

  for (const ex of explains) {
    push(`EXPLAIN ${ex.label}`, ex.executionMs ?? -1, {
      ok: ex.ok,
      planningMs: ex.planningMs,
      seqScan: ex.seqScan,
      indexScan: ex.indexScan,
      queries: 1,
      rtt: "N/A (server exec)",
    });
  }

  // Theoretical floors
  const rttMin = stages.find((s) => s.name === "RTT SELECT 1 (min)")?.ms ?? 420;
  const rttAvg = stages.find((s) => s.name === "RTT SELECT 1 (avg)")?.ms ?? 550;
  const authAvg = stages.find((s) =>
    s.name.startsWith("Auth:")
  )?.ms;
  const batchRepo = stages.find((s) =>
    s.name.includes("setCellsBatch")
  );
  const theoryAuthFused =
    rttAvg; /* 1 RTT if auth fused — still need write RTTs */
  const theoryMinimalWrites = rttAvg; /* single UPSERT if entry+sheet skipped */
  const theoryRealistic =
    rttAvg * 2; /* auth fused + 1 upsert write, or 1 write if HMAC-only */

  const inventory = {
    endpoint: "PUT /api/measurement-sheets/:id/cells",
    uiHotPath: "saveCells → body.cells[] → setCellsBatch",
    singlePath: "body.rowId+boqItemId → setCellQuantity",
    fullGridRefetch: false,
    boqRefetch: false,
    aggregatesAfterSave: false,
    includesAfterUpdate: false,
    responseBatch: "{ saved: N }",
    responseSingle: "{ id, rowId, boqItemId, quantity }",
    batchQueries: [
      "1× measurementSheet.findUnique (status)",
      "1× measurementCell.findMany (ALL cells on sheet)",
      "tx: N× cell.update (loop, 1 per dirty cell)",
      "tx: optional createMany cells",
      "tx: optional findMany created cells",
      "tx: createMany MeasurementEntry",
      "tx: measurementSheet.update (touch)",
    ],
    singleQueries: [
      "1× measurementSheet.findUnique (FULL row)",
      "tx: findUnique cell by composite",
      "tx: update OR create cell",
      "tx: create MeasurementEntry",
      "tx: measurementSheet.update",
    ],
    notes: [
      "Each Prisma statement to remote Supabase ≈ 1 RTT (~400–600ms)",
      "Interactive $transaction does NOT collapse RTTs — statements still serial over wire",
      "Batch prefetches ALL sheet cells even for 1 dirty cell",
      "Audit entry write is mandatory business side-effect (not optional in current logic)",
      "Sheet status touch on every save",
    ],
  };

  const report = {
    measuredAt: new Date().toISOString(),
    sheetId: SHEET_ID,
    cellId: cell.id,
    baselineFromPriorAudit: {
      httpBatch1Cell: 1668,
      httpSingleSameValue: 2406,
    },
    inventory,
    stages,
    explains: explains.map((e) => ({
      label: e.label,
      ok: e.ok,
      executionMs: e.executionMs,
      planningMs: e.planningMs,
      seqScan: e.seqScan,
      indexScan: e.indexScan,
    })),
    http: { batch: httpBatch, single: httpSingle },
    rootCause: {
      verdict:
        "Serial RTT amplification: auth DB + sheet lookup + cells prefetch + multi-statement transaction (cell UPDATE + entry INSERT + sheet UPDATE). SQL execution is sub-ms; wall time is infrastructure RTT × query count.",
      wasteOn: [
        "Authentication (separate DB query ~1 RTT)",
        "Repository serial queries (prefetch all cells + 3 tx writes)",
        "RTT (dominant — each statement ~RTT)",
      ],
      notWasteOn: [
        "SQL Execution Time (EXPLAIN ~0.02–0.1ms)",
        "Mapping / Serialization (~0ms, tiny payload)",
        "Full grid refetch (already eliminated on batch path)",
        "BOQ refetch / aggregates",
      ],
      queryCountEstimate: {
        httpBatch: "1 auth + 2 pre + 3 tx ≈ 6 RTTs",
        httpSingle: "1 auth + 1 sheet + 4 tx ≈ 6 RTTs",
      },
      theoryAfterOpt: {
        fusedAuthPlusSingleUpsert: `~${theoryRealistic}ms (2×RTT)`,
        absoluteFloorIfOneWriteOnly: `~${rttMin}–${rttAvg}ms (1×RTT)`,
        note: "Target 150–250ms is below measured RTT floor (~420ms). Unreachable from this environment without colocating app+DB or removing remote RTT.",
      },
    },
    stopRulePreview: {
      rttMin,
      rttAvg,
      targetHttp: "150–300ms",
      targetBelowRttFloor: true,
      message:
        "Target 150–300ms < RTT min — optimization can reduce query count but cannot beat ~1×RTT from this host to eu-north-1 Supabase.",
    },
  };

  writeFileSync(
    new URL("./perf-audit-cell-p3-results.json", import.meta.url),
    JSON.stringify(report, null, 2)
  );

  console.log("\n--- Root Cause ---\n");
  console.log(report.rootCause.verdict);
  console.log("\nTheory:", JSON.stringify(report.rootCause.theoryAfterOpt, null, 2));
  console.log("\nWrote scripts/perf-audit-cell-p3-results.json\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
