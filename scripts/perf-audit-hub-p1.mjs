/**
 * P1 Audit — GET /api/projects/:id/hub
 * Profiles auth, each Prisma query, mapping, HTTP end-to-end.
 * Read-only. No app code changes.
 *
 * Usage: node -r dotenv/config scripts/perf-audit-hub-p1.mjs
 *   (or inject env from .env.local first)
 */
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || "http://localhost:3000";
const PASSWORD = process.env.PERF_PASSWORD || "WegoAudit123!";
const prisma = new PrismaClient();

function ms(t0) {
  return Math.round(performance.now() - t0);
}

async function timed(name, fn, bag) {
  const t0 = performance.now();
  let ok = true;
  let detail = null;
  try {
    detail = await fn();
  } catch (e) {
    ok = false;
    detail = { error: e.message };
  }
  const elapsed = ms(t0);
  bag.push({ name, ms: elapsed, ok, detail });
  console.log(
    `${ok ? "OK" : "ERR"} ${String(elapsed).padStart(6)}ms  ${name}` +
      (detail && typeof detail === "object" && "count" in detail
        ? `  count=${detail.count}`
        : detail && typeof detail === "object" && "keys" in detail
          ? `  keys=${detail.keys}`
          : "")
  );
  return { elapsed, detail, ok };
}

async function login() {
  const jar = new Map();
  const store = (res) => {
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  };
  const cookie = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sysmgr", password: PASSWORD }),
  });
  store(res);
  if (!res.ok) throw new Error(`login ${res.status}`);
  return cookie;
}

async function explain(label, sql, params = []) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
      ...params
    );
    const text = rows.map((r) => Object.values(r)[0]).join("\n");
    return { label, ok: true, text };
  } catch (e) {
    return { label, ok: false, text: e.message };
  }
}

async function main() {
  const stages = [];
  const queries = [];
  const explains = [];

  console.log("\n=== P1 Project Hub Audit ===");
  console.log(`Base: ${BASE}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Resolve project
  const project = await prisma.project.findFirst({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!project) throw new Error("no projects");
  const projectId = project.id;
  console.log(`projectId=${projectId} (${project.name})\n`);

  // --- HTTP end-to-end (cold + warm) ---
  const cookie = await login();
  for (const label of ["HTTP hub cold", "HTTP hub warm"]) {
    await timed(
      label,
      async () => {
        const t0 = performance.now();
        const res = await fetch(`${BASE}/api/projects/${projectId}/hub`, {
          headers: { Cookie: cookie() },
        });
        const buf = Buffer.from(await res.arrayBuffer());
        return {
          status: res.status,
          bytes: buf.length,
          httpMs: ms(t0),
        };
      },
      stages
    );
  }

  // --- Auth simulation (same as requireOfficeUser DB part) ---
  const users = await prisma.user.findMany({
    where: { username: "sysmgr" },
    select: { id: true },
    take: 1,
  });
  const userId = users[0]?.id;
  await timed(
    "Auth: user.findUnique + employee include",
    async () => {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        include: { employee: true },
      });
      return { keys: u ? Object.keys(u).length : 0 };
    },
    stages
  );

  // --- Repository queries (individual) ---
  console.log("\n--- Individual Prisma queries ---\n");

  await timed(
    "Q1 project.findUnique + foreman",
    async () => {
      const p = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          contractNumber: true,
          contractor: true,
          location: true,
          status: true,
          progress: true,
          financialProgress: true,
          contractValue: true,
          completedValue: true,
          invoicedValue: true,
          measurementAxisType: true,
          measurementAxisLabel: true,
          foreman: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      return { keys: p ? Object.keys(p).length : 0 };
    },
    queries
  );

  await timed(
    "Q2 boqItem.findMany (3 fields)",
    async () => {
      const rows = await prisma.boqItem.findMany({
        where: { projectId, deletedAt: null },
        select: {
          contractQuantity: true,
          completedQuantity: true,
          progress: true,
        },
      });
      return { count: rows.length };
    },
    queries
  );

  await timed(
    "Q3 measurementSheet.findMany + _count",
    async () => {
      const rows = await prisma.measurementSheet.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          status: true,
          _count: { select: { rows: true, cells: true } },
        },
        orderBy: { sequenceNumber: "asc" },
      });
      return { count: rows.length };
    },
    queries
  );

  await timed(
    "Q4 measurementCell.aggregate",
    async () => {
      const a = await prisma.measurementCell.aggregate({
        where: { sheet: { projectId } },
        _sum: { quantity: true },
        _count: true,
      });
      return { count: a._count, sum: Number(a._sum.quantity || 0) };
    },
    queries
  );

  await timed(
    "Q5 measurementEntry.count",
    async () => {
      const c = await prisma.measurementEntry.count({
        where: { sheet: { projectId } },
      });
      return { count: c };
    },
    queries
  );

  await timed(
    "Q6 measurementEntry.findFirst (last)",
    async () => {
      const r = await prisma.measurementEntry.findFirst({
        where: { sheet: { projectId } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      return { keys: r ? 1 : 0 };
    },
    queries
  );

  await timed(
    "Q7 partialInvoice.findMany (all)",
    async () => {
      const rows = await prisma.partialInvoice.findMany({
        where: { projectId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          amount: true,
          sequenceNumber: true,
        },
        orderBy: { sequenceNumber: "desc" },
      });
      return { count: rows.length };
    },
    queries
  );

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await timed(
    "Q8 document.count (all)",
    async () => {
      const c = await prisma.document.count({ where: { projectId } });
      return { count: c };
    },
    queries
  );
  await timed(
    "Q9 document.count (recent week)",
    async () => {
      const c = await prisma.document.count({
        where: { projectId, createdAt: { gte: weekAgo } },
      });
      return { count: c };
    },
    queries
  );
  await timed(
    "Q10 workDiary.count",
    async () => {
      const c = await prisma.workDiary.count({
        where: { projectId, deletedAt: null },
      });
      return { count: c };
    },
    queries
  );
  await timed(
    "Q11 workDiary.findFirst (last)",
    async () => {
      const r = await prisma.workDiary.findFirst({
        where: { projectId, deletedAt: null },
        orderBy: { workDate: "desc" },
        select: { workDate: true },
      });
      return { keys: r ? 1 : 0 };
    },
    queries
  );
  await timed(
    "Q12 opsDeliveryNote.count (all)",
    async () => {
      const c = await prisma.opsDeliveryNote.count({
        where: { projectId, deletedAt: null },
      });
      return { count: c };
    },
    queries
  );
  await timed(
    "Q13 opsDeliveryNote.count (open)",
    async () => {
      const c = await prisma.opsDeliveryNote.count({
        where: {
          projectId,
          deletedAt: null,
          status: { in: ["draft", "pending_approval", "revision"] },
        },
      });
      return { count: c };
    },
    queries
  );
  await timed(
    "Q14 projectRoom.count (SERIAL after Promise.all)",
    async () => {
      const c = await prisma.projectRoom.count({
        where: { projectId, deletedAt: null, isHidden: false },
      });
      return { count: c };
    },
    queries
  );

  // Parallel wave (as in code today, WITHOUT unitRowCount)
  console.log("\n--- Parallel wave (12 queries, current code) ---\n");
  await timed(
    "WAVE Promise.all Q2–Q13 (12 queries)",
    async () => {
      await Promise.all([
        prisma.boqItem.findMany({
          where: { projectId, deletedAt: null },
          select: {
            contractQuantity: true,
            completedQuantity: true,
            progress: true,
          },
        }),
        prisma.measurementSheet.findMany({
          where: { projectId },
          select: {
            id: true,
            title: true,
            status: true,
            _count: { select: { rows: true, cells: true } },
          },
          orderBy: { sequenceNumber: "asc" },
        }),
        prisma.measurementCell.aggregate({
          where: { sheet: { projectId } },
          _sum: { quantity: true },
          _count: true,
        }),
        prisma.measurementEntry.count({
          where: { sheet: { projectId } },
        }),
        prisma.measurementEntry.findFirst({
          where: { sheet: { projectId } },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.partialInvoice.findMany({
          where: { projectId },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amount: true,
            sequenceNumber: true,
          },
          orderBy: { sequenceNumber: "desc" },
        }),
        prisma.document.count({ where: { projectId } }),
        prisma.document.count({
          where: { projectId, createdAt: { gte: weekAgo } },
        }),
        prisma.workDiary.count({
          where: { projectId, deletedAt: null },
        }),
        prisma.workDiary.findFirst({
          where: { projectId, deletedAt: null },
          orderBy: { workDate: "desc" },
          select: { workDate: true },
        }),
        prisma.opsDeliveryNote.count({
          where: { projectId, deletedAt: null },
        }),
        prisma.opsDeliveryNote.count({
          where: {
            projectId,
            deletedAt: null,
            status: { in: ["draft", "pending_approval", "revision"] },
          },
        }),
      ]);
      return { count: 12 };
    },
    stages
  );

  // Simulated full repository (project + wave + serial room)
  console.log("\n--- Full repository shape (current) ---\n");
  await timed(
    "REPO full getHub shape (Q1 + wave + Q14)",
    async () => {
      const tMap0 = performance.now();
      const p = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          progress: true,
          financialProgress: true,
          contractValue: true,
          completedValue: true,
          invoicedValue: true,
          measurementAxisType: true,
          measurementAxisLabel: true,
          contractNumber: true,
          contractor: true,
          location: true,
          status: true,
          foreman: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [
        boqItems,
        sheets,
        cellAgg,
        entryCount,
        lastEntry,
        invoices,
        documents,
        recentDocs,
        workDiaries,
        lastDiary,
        deliveryNotes,
        openDeliveries,
      ] = await Promise.all([
        prisma.boqItem.findMany({
          where: { projectId, deletedAt: null },
          select: {
            contractQuantity: true,
            completedQuantity: true,
            progress: true,
          },
        }),
        prisma.measurementSheet.findMany({
          where: { projectId },
          select: {
            id: true,
            title: true,
            status: true,
            _count: { select: { rows: true, cells: true } },
          },
          orderBy: { sequenceNumber: "asc" },
        }),
        prisma.measurementCell.aggregate({
          where: { sheet: { projectId } },
          _sum: { quantity: true },
          _count: true,
        }),
        prisma.measurementEntry.count({
          where: { sheet: { projectId } },
        }),
        prisma.measurementEntry.findFirst({
          where: { sheet: { projectId } },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.partialInvoice.findMany({ where: { projectId } }),
        prisma.document.count({ where: { projectId } }),
        prisma.document.count({
          where: { projectId, createdAt: { gte: week } },
        }),
        prisma.workDiary.count({
          where: { projectId, deletedAt: null },
        }),
        prisma.workDiary.findFirst({
          where: { projectId, deletedAt: null },
          orderBy: { workDate: "desc" },
          select: { workDate: true },
        }),
        prisma.opsDeliveryNote.count({
          where: { projectId, deletedAt: null },
        }),
        prisma.opsDeliveryNote.count({
          where: {
            projectId,
            deletedAt: null,
            status: { in: ["draft", "pending_approval", "revision"] },
          },
        }),
      ]);
      const unitRowCount = await prisma.projectRoom.count({
        where: { projectId, deletedAt: null, isHidden: false },
      });
      // mapping
      const boqCount = boqItems.length;
      const completedQty = boqItems.reduce(
        (s, i) => s + Number(i.completedQuantity || 0),
        0
      );
      const avgProgress =
        boqCount > 0
          ? Math.round(
              (boqItems.reduce((s, i) => s + (i.progress || 0), 0) / boqCount) *
                10
            ) / 10
          : p.progress;
      const payload = {
        project: { id: p.id, name: p.name },
        cards: {
          boq: { itemCount: boqCount, completedQuantity: completedQty, progressPercent: avgProgress },
          performance: {
            unitCount: unitRowCount,
            sheetCount: sheets.length,
            reportCount: entryCount || cellAgg._count || 0,
            lastReportAt: lastEntry?.createdAt ?? null,
          },
          invoices: { total: invoices.length },
          documents: { total: documents, recent: recentDocs },
          workDiaries: { total: workDiaries, lastAt: lastDiary?.workDate },
          deliveries: { total: deliveryNotes, open: openDeliveries },
        },
      };
      const mapMs = ms(tMap0);
      const json = JSON.stringify(payload);
      return {
        count: 14,
        mapWallMs: mapMs,
        bytes: Buffer.byteLength(json),
        sheets: sheets.length,
        invoices: invoices.length,
        boq: boqCount,
      };
    },
    stages
  );

  // Proposed lean aggregates (measurement only — not applied)
  console.log("\n--- Proposed lean alternatives (audit only) ---\n");
  await timed(
    "ALT boq aggregate (_count + _avg progress + _sum completed)",
    async () => {
      const a = await prisma.boqItem.aggregate({
        where: { projectId, deletedAt: null },
        _count: true,
        _avg: { progress: true },
        _sum: { completedQuantity: true },
      });
      return {
        count: a._count,
        avg: a._avg.progress,
        sum: Number(a._sum.completedQuantity || 0),
      };
    },
    queries
  );
  await timed(
    "ALT measurementSheet.count only",
    async () => {
      const c = await prisma.measurementSheet.count({ where: { projectId } });
      return { count: c };
    },
    queries
  );
  await timed(
    "ALT invoice groupBy status",
    async () => {
      const g = await prisma.partialInvoice.groupBy({
        by: ["status"],
        where: { projectId },
        _count: true,
        _sum: { amount: true },
      });
      return { count: g.length };
    },
    queries
  );

  // Simulated optimized: auth + project + ONE parallel wave including rooms, lean queries
  await timed(
    "ALT REPO lean: Q1 + parallel aggregates (incl rooms)",
    async () => {
      const p = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          progress: true,
          financialProgress: true,
          contractValue: true,
          completedValue: true,
          invoicedValue: true,
          measurementAxisType: true,
          measurementAxisLabel: true,
          contractNumber: true,
          contractor: true,
          location: true,
          status: true,
          foreman: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await Promise.all([
        prisma.boqItem.aggregate({
          where: { projectId, deletedAt: null },
          _count: true,
          _avg: { progress: true },
          _sum: { completedQuantity: true },
        }),
        prisma.measurementSheet.count({ where: { projectId } }),
        prisma.measurementCell.aggregate({
          where: { sheet: { projectId } },
          _count: true,
        }),
        prisma.measurementEntry.count({
          where: { sheet: { projectId } },
        }),
        prisma.measurementEntry.findFirst({
          where: { sheet: { projectId } },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.partialInvoice.groupBy({
          by: ["status"],
          where: { projectId },
          _count: true,
          _sum: { amount: true },
        }),
        prisma.partialInvoice.findMany({
          where: { projectId },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amount: true,
            sequenceNumber: true,
          },
          orderBy: { sequenceNumber: "desc" },
          take: 8,
        }),
        prisma.document.count({ where: { projectId } }),
        prisma.document.count({
          where: { projectId, createdAt: { gte: week } },
        }),
        prisma.workDiary.count({
          where: { projectId, deletedAt: null },
        }),
        prisma.workDiary.findFirst({
          where: { projectId, deletedAt: null },
          orderBy: { workDate: "desc" },
          select: { workDate: true },
        }),
        prisma.opsDeliveryNote.count({
          where: { projectId, deletedAt: null },
        }),
        prisma.opsDeliveryNote.count({
          where: {
            projectId,
            deletedAt: null,
            status: { in: ["draft", "pending_approval", "revision"] },
          },
        }),
        prisma.projectRoom.count({
          where: { projectId, deletedAt: null, isHidden: false },
        }),
      ]);
      return { count: 1 + 14, note: "still many RTTs; rooms in parallel" };
    },
    stages
  );

  // EXPLAIN ANALYZE for heavier patterns
  console.log("\n--- EXPLAIN ANALYZE ---\n");
  const ex1 = await explain(
    "boqItem by projectId",
    `SELECT "contractQuantity", "completedQuantity", progress FROM "BoqItem" WHERE "projectId" = $1 AND "deletedAt" IS NULL`,
    [projectId]
  );
  explains.push(ex1);
  console.log(`EXPLAIN boqItem: ${ex1.ok ? "ok" : ex1.text.slice(0, 80)}`);

  const ex2 = await explain(
    "measurementCell agg via sheet.projectId",
    `SELECT COUNT(*), COALESCE(SUM(c.quantity),0) FROM "MeasurementCell" c INNER JOIN "MeasurementSheet" s ON s.id = c."sheetId" WHERE s."projectId" = $1`,
    [projectId]
  );
  explains.push(ex2);
  console.log(`EXPLAIN cell agg: ${ex2.ok ? "ok" : ex2.text.slice(0, 80)}`);

  const ex3 = await explain(
    "measurementSheet + counts",
    `SELECT s.id, s.title, s.status, (SELECT COUNT(*) FROM "MeasurementRow" r WHERE r."sheetId" = s.id) AS rows_c, (SELECT COUNT(*) FROM "MeasurementCell" c WHERE c."sheetId" = s.id) AS cells_c FROM "MeasurementSheet" s WHERE s."projectId" = $1 ORDER BY s."sequenceNumber" ASC`,
    [projectId]
  );
  explains.push(ex3);
  console.log(`EXPLAIN sheets: ${ex3.ok ? "ok" : ex3.text.slice(0, 80)}`);

  const ex4 = await explain(
    "partialInvoice by projectId",
    `SELECT id, "invoiceNumber", status, amount, "sequenceNumber" FROM "PartialInvoice" WHERE "projectId" = $1 ORDER BY "sequenceNumber" DESC`,
    [projectId]
  );
  explains.push(ex4);

  // Baseline RTT
  await timed(
    "BASELINE SELECT 1",
    async () => {
      await prisma.$queryRaw`SELECT 1`;
      return { count: 1 };
    },
    stages
  );

  // UI usage audit (static)
  const uiUsage = {
    usedByProjectTreeHubPage: [
      "project.* (name, values, axisLabel, foreman…)",
      "cards.boq.itemCount/completedQuantity/progressPercent",
      "cards.performance.reportCount/unitCount/lastReportAt",
      "cards.invoices.total/draft/pending/approved/invoicedAmount",
      "cards.documents.total/recent",
      "cards.workDiaries.total/lastAt",
      "cards.deliveries.total/open",
    ],
    returnedButNotRenderedOnHubPage: [
      "cards.performance.sheetCount (in JSON, not shown in module lines)",
      "cards.invoices.items[0..7] (not in HubData UI type / not rendered)",
      "cards.invoices.sent / paid (not in module lines)",
      "sheets[].title/status/_count.rows/_count.cells (only length used)",
      "boqItems rows (only aggregates needed)",
      "cellAgg._sum.quantity (unused; only _count fallback)",
    ],
    queryCountCurrent:
      "1 auth user + 1 project + 12 parallel + 1 serial rooms = 15 DB round-trips",
    serialWaterfallInRepo: "projectRoom.count AFTER Promise.all",
  };

  const httpWarm = stages.find((s) => s.name === "HTTP hub warm");
  const repoFull = stages.find((s) => s.name.startsWith("REPO full"));
  const auth = stages.find((s) => s.name.startsWith("Auth:"));
  const wave = stages.find((s) => s.name.startsWith("WAVE"));
  const baseline = stages.find((s) => s.name.startsWith("BASELINE"));

  const totalHttp = httpWarm?.ms || 0;
  const breakdown = [
    {
      stage: "Authentication (user DB lookup)",
      ms: auth?.ms ?? 0,
      pct: totalHttp ? Math.round(((auth?.ms ?? 0) / totalHttp) * 100) : null,
    },
    {
      stage: "Repository Q1 project",
      ms: queries.find((q) => q.name.startsWith("Q1"))?.ms ?? 0,
      pct: null,
    },
    {
      stage: "Repository parallel wave (12 queries)",
      ms: wave?.ms ?? 0,
      pct: totalHttp ? Math.round(((wave?.ms ?? 0) / totalHttp) * 100) : null,
    },
    {
      stage: "Repository serial Q14 rooms",
      ms: queries.find((q) => q.name.startsWith("Q14"))?.ms ?? 0,
      pct: null,
    },
    {
      stage: "Full repo wall (Q1+wave+Q14+map)",
      ms: repoFull?.ms ?? 0,
      pct: totalHttp
        ? Math.round(((repoFull?.ms ?? 0) / totalHttp) * 100)
        : null,
    },
    {
      stage: "HTTP total warm (auth+repo+serialize+network)",
      ms: totalHttp,
      pct: 100,
    },
    {
      stage: "DB RTT floor (SELECT 1)",
      ms: baseline?.ms ?? 0,
      pct: null,
    },
  ];

  console.log("\n=== STAGE BREAKDOWN ===");
  for (const b of breakdown) {
    console.log(
      `${String(b.ms).padStart(6)}ms  ${b.pct != null ? String(b.pct).padStart(3) + "%" : "    "}  ${b.stage}`
    );
  }

  const out = {
    measuredAt: new Date().toISOString(),
    projectId,
    stages,
    queries,
    breakdown,
    explains: explains.map((e) => ({
      label: e.label,
      ok: e.ok,
      text: e.text,
    })),
    uiUsage,
    stopRule: {
      triggered: (baseline?.ms ?? 0) > 200,
      reason:
        "If SELECT 1 / each trivial query is hundreds of ms, bottleneck is DB RTT/region — present findings before optimizing API further beyond reducing query count.",
    },
  };

  writeFileSync(
    new URL("./perf-audit-hub-p1-results.json", import.meta.url),
    JSON.stringify(out, null, 2)
  );
  console.log("\nWrote scripts/perf-audit-hub-p1-results.json");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
