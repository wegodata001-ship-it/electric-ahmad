/**
 * P2 Audit — GET /api/measurement-sheets/:id
 * Read-only. No app code changes.
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

const sheetInclude = {
  rows: {
    orderBy: { sortOrder: "asc" },
    include: {
      projectRoom: {
        select: {
          id: true,
          name: true,
          floor: true,
          code: true,
          sortOrder: true,
          isHidden: true,
          deletedAt: true,
        },
      },
    },
  },
  cells: {
    include: {
      boqItem: {
        select: {
          id: true,
          code: true,
          description: true,
          unit: true,
          contractQuantity: true,
          completedQuantity: true,
          unitPrice: true,
          invoicedQuantity: true,
          remainingQuantity: true,
          deletedAt: true,
        },
      },
    },
  },
  project: {
    select: {
      id: true,
      name: true,
      contractor: true,
      location: true,
      measurementAxisType: true,
      measurementAxisLabel: true,
    },
  },
  createdBy: { select: { id: true, name: true } },
  approvals: {
    orderBy: { createdAt: "desc" },
    include: { approver: { select: { id: true, name: true, role: true } } },
  },
  reviewNotes: {
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true } } },
  },
  events: {
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { actor: { select: { id: true, name: true } } },
  },
  versions: { orderBy: { version: "desc" }, take: 20 },
};

async function explain(label, sql) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`
    );
    const text = rows.map((r) => Object.values(r)[0]).join("\n");
    const exec = text.match(/Execution Time:\s*([\d.]+)\s*ms/);
    return {
      label,
      ok: true,
      executionMs: exec ? Number(exec[1]) : null,
      text,
    };
  } catch (e) {
    return { label, ok: false, executionMs: null, text: e.message };
  }
}

async function main() {
  const stages = [];
  const push = (name, elapsed, extra = {}) => {
    stages.push({ name, ms: elapsed, ...extra });
    console.log(
      `${extra.ok === false ? "ERR" : "OK "} ${String(elapsed).padStart(6)}ms  ${name}` +
        (extra.queries != null ? `  q=${extra.queries}` : "") +
        (extra.bytes != null ? `  ${extra.bytes}B` : "") +
        (extra.count != null ? `  n=${extra.count}` : "")
    );
  };

  console.log("\n=== P2 Measurement Sheet Audit ===");
  console.log(`sheet=${SHEET_ID} project=${PROJECT_ID}\n`);

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sysmgr", password: PASSWORD }),
  });
  const cookie = (login.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");

  // RTT
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
    push("RTT SELECT 1 (avg)", Math.round(samples.reduce((a, b) => a + b, 0) / samples.length), {
      queries: 1,
      rtt: 1,
    });
  }

  // Auth alone (requireOfficeUser shape)
  {
    const user = await prisma.user.findFirst({
      where: { username: "sysmgr" },
      select: { id: true },
    });
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
    push("Auth: requireOfficeUser slim query", ms(t0), { queries: 1, rtt: 1 });
  }

  // Full getById include (current)
  let fullRow = null;
  {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      fullRow = await prisma.measurementSheet.findUnique({
        where: { id: SHEET_ID },
        include: sheetInclude,
      });
      samples.push(ms(t0));
    }
    push("REPO getById sheetInclude (min)", Math.min(...samples), {
      queries: "1 Prisma (multi-SQL under hood)",
      rtt: "multi",
      samples,
      rows: fullRow?.rows?.length,
      cells: fullRow?.cells?.length,
      approvals: fullRow?.approvals?.length,
      reviewNotes: fullRow?.reviewNotes?.length,
      events: fullRow?.events?.length,
      versions: fullRow?.versions?.length,
    });
    push("REPO getById sheetInclude (avg)", Math.round(samples.reduce((a, b) => a + b, 0) / samples.length), {
      samples,
    });
  }

  // Mapping cost
  {
    const t0 = performance.now();
    // light map simulation
    const cells = (fullRow?.cells ?? []).map((c) => ({
      id: c.id,
      qty: Number(c.quantity),
      boq: c.boqItem?.code,
    }));
    const json = JSON.stringify({
      id: fullRow?.id,
      rows: fullRow?.rows,
      cells,
      approvals: fullRow?.approvals,
      reviewNotes: fullRow?.reviewNotes,
      events: fullRow?.events,
      versions: fullRow?.versions,
    });
    push("Mapping + JSON.stringify (local)", ms(t0), {
      queries: 0,
      bytes: Buffer.byteLength(json),
      cellCount: cells.length,
    });
  }

  // Split queries — what Prisma include fans out to
  console.log("\n--- Split query timings ---\n");
  {
    const t0 = performance.now();
    const s = await prisma.measurementSheet.findUnique({
      where: { id: SHEET_ID },
      select: {
        id: true,
        projectId: true,
        title: true,
        status: true,
        notes: true,
        currentVersion: true,
        sequenceNumber: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
            contractor: true,
            location: true,
            measurementAxisType: true,
            measurementAxisLabel: true,
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });
    push("Q-sheet+project+createdBy", ms(t0), {
      queries: 1,
      rtt: 1,
      count: s ? 1 : 0,
    });
  }
  {
    const t0 = performance.now();
    const rows = await prisma.measurementSheetRow.findMany({
      where: { sheetId: SHEET_ID },
      orderBy: { sortOrder: "asc" },
      include: {
        projectRoom: {
          select: {
            id: true,
            name: true,
            floor: true,
            code: true,
            sortOrder: true,
            isHidden: true,
            deletedAt: true,
          },
        },
      },
    });
    push("Q-rows+projectRoom", ms(t0), {
      queries: 1,
      rtt: 1,
      count: rows.length,
    });
  }
  {
    const t0 = performance.now();
    const cells = await prisma.measurementCell.findMany({
      where: { sheetId: SHEET_ID },
      select: {
        id: true,
        rowId: true,
        boqItemId: true,
        quantity: true,
      },
    });
    push("Q-cells slim (ids+qty only)", ms(t0), {
      queries: 1,
      rtt: 1,
      count: cells.length,
    });
  }
  {
    const t0 = performance.now();
    const cells = await prisma.measurementCell.findMany({
      where: { sheetId: SHEET_ID },
      include: {
        boqItem: {
          select: {
            id: true,
            code: true,
            description: true,
            unit: true,
            contractQuantity: true,
            completedQuantity: true,
            unitPrice: true,
            invoicedQuantity: true,
            remainingQuantity: true,
            deletedAt: true,
          },
        },
      },
    });
    push("Q-cells+boqItem include", ms(t0), {
      queries: 1,
      rtt: 1,
      count: cells.length,
    });
  }
  {
    const t0 = performance.now();
    // Distinct BOQ ids then one findMany — alt pattern
    const cellBoq = await prisma.measurementCell.findMany({
      where: { sheetId: SHEET_ID },
      select: { boqItemId: true },
      distinct: ["boqItemId"],
    });
    const ids = cellBoq.map((c) => c.boqItemId);
    const boq = await prisma.boqItem.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        code: true,
        description: true,
        unit: true,
        contractQuantity: true,
        completedQuantity: true,
        unitPrice: true,
        invoicedQuantity: true,
        remainingQuantity: true,
        deletedAt: true,
      },
    });
    push("ALT cells distinct boqIds + boq findMany (2q)", ms(t0), {
      queries: 2,
      rtt: 2,
      count: boq.length,
    });
  }
  {
    const t0 = performance.now();
    await Promise.all([
      prisma.measurementSheetApproval.findMany({
        where: { sheetId: SHEET_ID },
        orderBy: { createdAt: "desc" },
        include: {
          approver: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.measurementSheetReviewNote.findMany({
        where: { sheetId: SHEET_ID },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true } } },
      }),
      prisma.measurementSheetEvent.findMany({
        where: { sheetId: SHEET_ID },
        orderBy: { createdAt: "desc" },
        take: 40,
        include: { actor: { select: { id: true, name: true } } },
      }),
      prisma.measurementSheetVersion.findMany({
        where: { sheetId: SHEET_ID },
        orderBy: { version: "desc" },
        take: 20,
      }),
    ]);
    push("Q-meta‖ approvals+notes+events+versions", ms(t0), {
      queries: 4,
      rtt: 4,
    });
  }
  {
    const t0 = performance.now();
    await Promise.all([
      prisma.measurementSheet.findUnique({
        where: { id: SHEET_ID },
        select: {
          id: true,
          projectId: true,
          title: true,
          status: true,
          notes: true,
          currentVersion: true,
          sequenceNumber: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          submittedAt: true,
          approvedAt: true,
          returnedAt: true,
          lastReturnComment: true,
          partialInvoiceId: true,
          clientSignatureUrl: true,
          clientSignedName: true,
          clientSignedAt: true,
          project: {
            select: {
              id: true,
              name: true,
              contractor: true,
              location: true,
              measurementAxisType: true,
              measurementAxisLabel: true,
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.measurementSheetRow.findMany({
        where: { sheetId: SHEET_ID },
        orderBy: { sortOrder: "asc" },
        include: {
          projectRoom: {
            select: {
              id: true,
              name: true,
              floor: true,
              code: true,
              sortOrder: true,
              isHidden: true,
              deletedAt: true,
            },
          },
        },
      }),
      prisma.measurementCell.findMany({
        where: { sheetId: SHEET_ID },
        select: {
          id: true,
          rowId: true,
          boqItemId: true,
          quantity: true,
        },
      }),
      prisma.boqItem.findMany({
        where: {
          projectId: PROJECT_ID,
          deletedAt: null,
          status: { not: "cancelled" },
        },
        select: {
          id: true,
          code: true,
          description: true,
          unit: true,
          contractQuantity: true,
          completedQuantity: true,
          unitPrice: true,
          invoicedQuantity: true,
          remainingQuantity: true,
        },
      }),
      prisma.measurementSheetApproval.findMany({
        where: { sheetId: SHEET_ID },
        include: {
          approver: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.measurementSheetReviewNote.findMany({
        where: { sheetId: SHEET_ID },
        include: { author: { select: { id: true, name: true } } },
      }),
      prisma.measurementSheetEvent.findMany({
        where: { sheetId: SHEET_ID },
        take: 40,
        include: { actor: { select: { id: true, name: true } } },
      }),
      prisma.measurementSheetVersion.findMany({
        where: { sheetId: SHEET_ID },
        take: 20,
      }),
    ]);
    push("THEORY parallel split (8 queries)", ms(t0), {
      queries: 8,
      rtt: 8,
    });
  }
  {
    const t0 = performance.now();
    // Single SQL: sheet header + cell grid + distinct boq
    await prisma.$queryRaw`
      SELECT s.id, s.title, s.status,
             (SELECT COUNT(*) FROM "MeasurementSheetRow" r WHERE r."sheetId" = s.id) AS row_c,
             (SELECT COUNT(*) FROM "MeasurementCell" c WHERE c."sheetId" = s.id) AS cell_c
      FROM "MeasurementSheet" s
      WHERE s.id = ${SHEET_ID}
    `;
    const cells = await prisma.$queryRaw`
      SELECT c.id, c."rowId", c."boqItemId", c.quantity,
             b.code, b.description, b.unit,
             b."contractQuantity", b."completedQuantity", b."unitPrice",
             b."invoicedQuantity", b."remainingQuantity", b."deletedAt"
      FROM "MeasurementCell" c
      LEFT JOIN "BoqItem" b ON b.id = c."boqItemId"
      WHERE c."sheetId" = ${SHEET_ID}
    `;
    const rows = await prisma.$queryRaw`
      SELECT r.id, r.name, r."sortOrder", r.notes, r."projectRoomId",
             pr.name AS room_name, pr.floor, pr.code, pr."sortOrder" AS room_sort,
             pr."isHidden", pr."deletedAt"
      FROM "MeasurementSheetRow" r
      LEFT JOIN "ProjectRoom" pr ON pr.id = r."projectRoomId"
      WHERE r."sheetId" = ${SHEET_ID}
      ORDER BY COALESCE(pr."sortOrder", r."sortOrder") ASC
    `;
    push("THEORY 3 raw SQL (header+cells+rows)", ms(t0), {
      queries: 3,
      rtt: 3,
      count: Array.isArray(cells) ? cells.length : 0,
      rows: Array.isArray(rows) ? rows.length : 0,
    });
  }
  {
    const t0 = performance.now();
    await prisma.$queryRaw`
      WITH sheet AS (
        SELECT * FROM "MeasurementSheet" WHERE id = ${SHEET_ID}
      ),
      rows AS (
        SELECT COALESCE(json_agg(x ORDER BY sort_key), '[]'::json) AS data
        FROM (
          SELECT r.id, COALESCE(pr.name, r.name) AS name,
                 COALESCE(pr."sortOrder", r."sortOrder") AS sort_key,
                 r.notes, r."projectRoomId" AS "projectRoomId",
                 pr.floor, pr.code, pr."isHidden", pr."deletedAt"
          FROM "MeasurementSheetRow" r
          LEFT JOIN "ProjectRoom" pr ON pr.id = r."projectRoomId"
          WHERE r."sheetId" = ${SHEET_ID}
        ) x
      ),
      cells AS (
        SELECT COALESCE(json_agg(x), '[]'::json) AS data
        FROM (
          SELECT c.id, c."rowId", c."boqItemId", c.quantity,
                 json_build_object(
                   'id', b.id, 'code', b.code, 'description', b.description,
                   'unit', b.unit,
                   'contractQuantity', b."contractQuantity",
                   'completedQuantity', b."completedQuantity",
                   'unitPrice', b."unitPrice",
                   'invoicedQuantity', b."invoicedQuantity",
                   'remainingQuantity', b."remainingQuantity",
                   'deletedAt', b."deletedAt"
                 ) AS "boqItem"
          FROM "MeasurementCell" c
          LEFT JOIN "BoqItem" b ON b.id = c."boqItemId"
          WHERE c."sheetId" = ${SHEET_ID}
        ) x
      )
      SELECT s.id, s.title, s.status, rows.data AS rows, cells.data AS cells
      FROM sheet s, rows, cells
    `;
    push("THEORY 1 CTE grid (sheet+rows+cells+boq)", ms(t0), {
      queries: 1,
      rtt: 1,
    });
  }

  // HTTP
  console.log("\n--- HTTP ---\n");
  const httpSheet = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/measurement-sheets/${SHEET_ID}`, {
      headers: { Cookie: cookie },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const elapsed = ms(t0);
    httpSheet.push({ ms: elapsed, bytes: buf.length, status: res.status });
    push(`HTTP GET sheet #${i + 1}`, elapsed, {
      queries: 2,
      rtt: 2,
      bytes: buf.length,
      status: res.status,
    });
  }

  // FE journey after P0: listSheets ‖ boq ‖ getSheet
  {
    const t0 = performance.now();
    await Promise.all([
      fetch(`${BASE}/api/measurement-sheets?projectId=${PROJECT_ID}`, {
        headers: { Cookie: cookie },
      }),
      fetch(`${BASE}/api/boq?projectId=${PROJECT_ID}`, {
        headers: { Cookie: cookie },
      }),
      fetch(`${BASE}/api/measurement-sheets/${SHEET_ID}`, {
        headers: { Cookie: cookie },
      }),
    ]).then(async (resps) => {
      await Promise.all(resps.map((r) => r.arrayBuffer()));
    });
    push("FE journey listSheets‖boq‖getSheet", ms(t0), {
      queries: "3 HTTP",
      note: "BOQ duplicated: once in sheet.cells[].boqItem and /api/boq",
    });
  }

  // EXPLAIN
  console.log("\n--- EXPLAIN ANALYZE ---\n");
  const explains = [];
  explains.push(
    await explain(
      "cells by sheetId",
      `SELECT id, "rowId", "boqItemId", quantity FROM "MeasurementCell" WHERE "sheetId" = '${SHEET_ID}'`
    )
  );
  explains.push(
    await explain(
      "cells JOIN boqItem",
      `SELECT c.id, c.quantity, b.code, b.description FROM "MeasurementCell" c LEFT JOIN "BoqItem" b ON b.id = c."boqItemId" WHERE c."sheetId" = '${SHEET_ID}'`
    )
  );
  explains.push(
    await explain(
      "rows JOIN projectRoom",
      `SELECT r.id, r.name, pr.name FROM "MeasurementSheetRow" r LEFT JOIN "ProjectRoom" pr ON pr.id = r."projectRoomId" WHERE r."sheetId" = '${SHEET_ID}'`
    )
  );
  explains.push(
    await explain(
      "sheet by id",
      `SELECT id, title, status FROM "MeasurementSheet" WHERE id = '${SHEET_ID}'`
    )
  );

  for (const e of explains) {
    console.log(
      `${e.ok ? "OK" : "ERR"} exec=${e.executionMs ?? "?"}ms  ${e.label}`
    );
  }

  const rttMin = stages.find((s) => s.name === "RTT SELECT 1 (min)")?.ms ?? 0;
  const authMs = stages.find((s) => s.name.startsWith("Auth:"))?.ms ?? 0;
  const repoAvg =
    stages.find((s) => s.name === "REPO getById sheetInclude (avg)")?.ms ?? 0;
  const httpAvg = Math.round(
    httpSheet.reduce((s, h) => s + h.ms, 0) / httpSheet.length
  );
  const mapMs =
    stages.find((s) => s.name.startsWith("Mapping"))?.ms ?? 0;
  const theory1 =
    stages.find((s) => s.name.includes("1 CTE grid"))?.ms ?? null;
  const cellsBoq =
    stages.find((s) => s.name.includes("cells+boqItem"))?.ms ?? 0;
  const cellsSlim =
    stages.find((s) => s.name.includes("cells slim"))?.ms ?? 0;

  const breakdown = [
    { stage: "Authentication (DB user lookup)", ms: authMs, queries: 1, rtt: 1 },
    { stage: "Repository getById (Prisma include)", ms: repoAvg, queries: "~6-8 SQL", rtt: "bundled" },
    { stage: "  └ cells+boqItem alone", ms: cellsBoq, queries: 1, rtt: 1 },
    { stage: "  └ cells slim alone", ms: cellsSlim, queries: 1, rtt: 1 },
    { stage: "Mapping + serialization (CPU)", ms: mapMs, queries: 0, rtt: 0 },
    { stage: "HTTP total (auth+repo+network)", ms: httpAvg, queries: 2, rtt: 2 },
    { stage: "RTT floor", ms: rttMin, queries: 1, rtt: 1 },
    { stage: "SQL exec (EXPLAIN cells JOIN boq)", ms: explains[1]?.executionMs, queries: 1, rtt: 0 },
  ];

  const out = {
    measuredAt: new Date().toISOString(),
    sheetId: SHEET_ID,
    projectId: PROJECT_ID,
    counts: {
      rows: fullRow?.rows?.length ?? 0,
      cells: fullRow?.cells?.length ?? 0,
      approvals: fullRow?.approvals?.length ?? 0,
      reviewNotes: fullRow?.reviewNotes?.length ?? 0,
      events: fullRow?.events?.length ?? 0,
      versions: fullRow?.versions?.length ?? 0,
    },
    stages,
    breakdown,
    explains: explains.map((e) => ({
      label: e.label,
      ok: e.ok,
      executionMs: e.executionMs,
      text: e.text,
    })),
    http: {
      samples: httpSheet,
      avgMs: httpAvg,
      minMs: Math.min(...httpSheet.map((h) => h.ms)),
      bytes: httpSheet[0]?.bytes,
    },
    rootCause: {
      primary: "RTT × (auth query + heavy Prisma include fan-out)",
      sqlHealthy: (explains[1]?.executionMs ?? 1) < 5,
      overFetch: [
        "boqItem nested on every cell (duplicate BOQ columns × cell count)",
        "FE also fetches /api/boq in parallel — duplicate BOQ data",
        "approvals + reviewNotes + events + versions on every grid open",
        "full Employee-like room fields including deletedAt/isHidden filterable server-side",
      ],
      nPlusOne: "No app-level N+1 loop; Prisma include issues JOINs/extra queries in one findUnique",
      serialInRepo: "Single findUnique — Prisma may still run multiple SQL sequentially under the hood",
      theoryFusedGridMs: theory1,
      estimatedAfterOptMs: Math.max(rttMin, theory1 || rttMin) + Math.min(authMs, rttMin) + 80,
      canBeat1s:
        Math.max(rttMin, theory1 || rttMin) + Math.min(authMs, rttMin) + 80 < 1000,
      note: "Fusing auth into sheet SQL (like hub) + slim grid CTE could approach ~1–2 RTT",
    },
    recommendations: [
      {
        id: "A",
        title: "Fuse auth into getById SQL (like P1.5 hub)",
        saves: "1 RTT (~400–600ms)",
      },
      {
        id: "B",
        title: "Split grid vs metadata endpoints OR lazy-load approvals/events/versions",
        saves: "payload + optional 2nd wave",
        contractNote: "Requires careful API contract — prefer same GET with lighter default fields if contract must stay",
      },
      {
        id: "C",
        title: "Dedupe BOQ: cells store boqItemId only; columns from /api/boq OR one distinct boq join",
        saves: "smaller include; FE already loads BOQ",
      },
      {
        id: "D",
        title: "Raw SQL CTE for sheet+rows+cells+boq in 1 RTT",
        saves: "Prisma include overhead; theory ~" + theory1 + "ms",
      },
      {
        id: "E",
        title: "Do not add cache / migrations",
        saves: "n/a",
      },
    ],
    stop: "No optimization until approval",
  };

  console.log("\n=== BREAKDOWN ===");
  for (const b of breakdown) {
    console.log(
      `${String(b.ms ?? "-").padStart(8)}  q=${String(b.queries).padEnd(8)} rtt=${String(b.rtt).padEnd(8)} ${b.stage}`
    );
  }
  console.log("\n=== ROOT CAUSE ===");
  console.log(JSON.stringify(out.rootCause, null, 2));

  writeFileSync(
    new URL("./perf-audit-sheet-p2-results.json", import.meta.url),
    JSON.stringify(out, null, 2)
  );
  console.log("\nWrote scripts/perf-audit-sheet-p2-results.json");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
