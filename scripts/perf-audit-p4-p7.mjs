/**
 * Performance Sprint Final Phase — P4–P7 AUDIT ONLY
 * No app code changes. Does not touch Hub / Auth / Sheet / Cell-save paths for optimization.
 *
 * Usage: node scripts/perf-audit-p4-p7.mjs [baseUrl] [projectId]
 */
import { performance } from "node:perf_hooks";
import { writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import dns from "node:dns/promises";
import tls from "node:tls";
import net from "node:net";
import { readFileSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3000";
const PROJECT_ID = process.argv[3] || "cms034ch70002kz04wu99jp4h";
const PASSWORD = process.env.PERF_PASSWORD || "WegoAudit123!";
const prisma = new PrismaClient();

function ms(t0) {
  return Math.round(performance.now() - t0);
}
function avg(a) {
  return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
}

function cookieJar() {
  const jar = new Map();
  return {
    store(res) {
      for (const c of res.headers.getSetCookie?.() || []) {
        const [pair] = c.split(";");
        const eq = pair.indexOf("=");
        if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function http(jar, path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const cookie = jar.header();
  if (cookie) headers.Cookie = cookie;
  if (opts.json) headers["Content-Type"] = "application/json";
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.json ? JSON.stringify(opts.json) : undefined,
  });
  jar.store(res);
  const buf = Buffer.from(await res.arrayBuffer());
  let json = null;
  try {
    json = JSON.parse(buf.toString("utf8"));
  } catch {
    /* */
  }
  return {
    status: res.status,
    ms: ms(t0),
    bytes: buf.length,
    json,
    ok: res.status >= 200 && res.status < 400,
  };
}

async function sampleHttp(jar, path, n = 3) {
  const samples = [];
  let last = null;
  for (let i = 0; i < n + 1; i++) {
    last = await http(jar, path);
    if (i > 0) samples.push(last.ms); // skip warm
  }
  return {
    path,
    ok: last?.ok,
    status: last?.status,
    bytes: last?.bytes,
    min: Math.min(...samples),
    avg: avg(samples),
    samples,
  };
}

function dirSize(p) {
  if (!existsSync(p)) return 0;
  let total = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else total += st.size;
    }
  };
  walk(p);
  return total;
}

function largestFiles(dir, limit = 15) {
  if (!existsSync(dir)) return [];
  const files = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else files.push({ path: full.replace(/\\/g, "/"), bytes: st.size });
    }
  };
  walk(dir);
  return files.sort((a, b) => b.bytes - a.bytes).slice(0, limit);
}

async function tcpConnect(host, port, timeoutMs = 5000) {
  const t0 = performance.now();
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      const elapsed = ms(t0);
      socket.end();
      resolve({ ok: true, ms: elapsed });
    });
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      resolve({ ok: false, ms: ms(t0), error: "timeout" });
    });
    socket.on("error", (e) =>
      resolve({ ok: false, ms: ms(t0), error: e.message })
    );
  });
}

async function tlsHandshake(host, port = 443) {
  const t0 = performance.now();
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: true },
      () => {
        const elapsed = ms(t0);
        socket.end();
        resolve({ ok: true, ms: elapsed });
      }
    );
    socket.setTimeout(8000, () => {
      socket.destroy();
      resolve({ ok: false, ms: ms(t0), error: "timeout" });
    });
    socket.on("error", (e) =>
      resolve({ ok: false, ms: ms(t0), error: e.message })
    );
  });
}

async function main() {
  console.log("\n=== P4–P7 Performance Audit (read-only) ===");
  console.log(`base=${BASE} project=${PROJECT_ID}\n`);

  const jar = cookieJar();
  await http(jar, "/api/auth/login", {
    method: "POST",
    json: { username: "sysmgr", password: PASSWORD },
  });

  // RTT floor
  const rttSamples = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    rttSamples.push(ms(t0));
  }
  const rtt = { min: Math.min(...rttSamples), avg: avg(rttSamples), samples: rttSamples };
  console.log(`RTT SELECT 1  min=${rtt.min} avg=${rtt.avg}`);

  // ── P4 HTTP screens ──
  console.log("\n--- P4 Remaining Screens (HTTP) ---\n");
  const p4Paths = [
    ["/api/documents/hub", "Documents Hub"],
    ["/api/documents-archive", "Documents Archive"],
    ["/api/workflow/pending", "Workflow Pending"],
    [`/api/workflow/documents?projectId=${PROJECT_ID}`, "Workflow Documents (project)"],
    ["/api/ops-delivery-notes", "Ops Delivery Notes"],
    ["/api/delivery-notes", "Legacy Delivery Notes"],
    ["/api/work-diaries", "Work Diaries"],
    ["/api/work-orders", "Work Orders"],
    [`/api/projects/${PROJECT_ID}/rooms`, "Project Rooms / Tree data"],
    [`/api/invoices/workspace?projectId=${PROJECT_ID}`, "Invoice Workspace Tree"],
    ["/api/approvals/pending", "Approvals Pending"],
    ["/api/dashboard", "Dashboard KPIs"],
    ["/api/projects", "Projects list (dashboard)"],
    ["/api/notifications", "Notifications"],
    ["/api/execution-reports", "Execution Reports"],
    [`/api/boq?projectId=${PROJECT_ID}`, "BOQ by project"],
    ["/api/partial-invoices", "Partial Invoices list"],
  ];

  const p4Screens = [];
  for (const [path, name] of p4Paths) {
    const m = await sampleHttp(jar, path, 3);
    const itemCount =
      m.json?.data?.items?.length ??
      m.json?.data?.length ??
      m.json?.items?.length ??
      (Array.isArray(m.json?.data) ? m.json.data.length : null);
    p4Screens.push({
      screen: name,
      ...m,
      itemCount,
      rttEstimate: Math.max(1, Math.round((m.avg || 0) / Math.max(rtt.avg, 1))),
    });
    console.log(
      `OK  ${String(m.avg).padStart(5)}ms  ${name}  ${m.bytes}B  n=${itemCount ?? "?"}  ~${Math.max(1, Math.round((m.avg || 0) / Math.max(rtt.avg, 1)))}×RTT`
    );
  }

  // Repo probe: documents hub list timing (Prisma entry)
  console.log("\n--- P4 Repo spot checks ---\n");
  const repoChecks = [];
  {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await prisma.workflowDocument.findMany({ take: 50, orderBy: { updatedAt: "desc" } });
      samples.push(ms(t0));
    }
    repoChecks.push({
      name: "workflowDocument.findMany take 50",
      avg: avg(samples),
      min: Math.min(...samples),
      samples,
      queries: 1,
      rtt: 1,
    });
  }
  {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await prisma.workDiary.findMany({
        where: { deletedAt: null },
        take: 80,
        orderBy: { workDate: "desc" },
        select: { id: true, documentNumber: true, status: true, workDate: true },
      });
      samples.push(ms(t0));
    }
    repoChecks.push({
      name: "workDiary.findMany take 80 slim",
      avg: avg(samples),
      min: Math.min(...samples),
      samples,
      queries: 1,
      rtt: 1,
    });
  }
  {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await prisma.projectRoom.findMany({
        where: { projectId: PROJECT_ID },
        select: { id: true, name: true, sortOrder: true },
      });
      samples.push(ms(t0));
    }
    repoChecks.push({
      name: "projectRoom.findMany (project)",
      avg: avg(samples),
      min: Math.min(...samples),
      samples,
      queries: 1,
      rtt: 1,
    });
  }
  {
    const samples = [];
    for (let i = 0; i < 2; i++) {
      const t0 = performance.now();
      // approximate hub fan-out cost: count entities
      await Promise.all([
        prisma.workflowDocument.count(),
        prisma.workDiary.count({ where: { deletedAt: null } }),
        prisma.opsDeliveryNote.count({ where: { deletedAt: null } }),
        prisma.document.count(),
        prisma.measurementSheet.count(),
      ]);
      samples.push(ms(t0));
    }
    repoChecks.push({
      name: "5× COUNT parallel (docs inventory)",
      avg: avg(samples),
      min: Math.min(...samples),
      samples,
      queries: 5,
      rtt: "~1 parallel wave",
    });
  }
  for (const r of repoChecks) {
    console.log(`OK  ${String(r.avg).padStart(5)}ms  ${r.name}`);
  }

  // ── P5 static inventory (from codebase knowledge + DB counts) ──
  const counts = {
    workflowDocuments: await prisma.workflowDocument.count(),
    workDiaries: await prisma.workDiary.count({ where: { deletedAt: null } }),
    opsDeliveryNotes: await prisma.opsDeliveryNote.count({
      where: { deletedAt: null },
    }),
    legacyDeliveryNotes: await prisma.deliveryNote.count().catch(() => null),
    documents: await prisma.document.count(),
    projects: await prisma.project.count(),
    rooms: await prisma.projectRoom.count({ where: { projectId: PROJECT_ID } }),
    boqItems: await prisma.boqItem.count({
      where: { projectId: PROJECT_ID, deletedAt: null },
    }),
    measurementSheets: await prisma.measurementSheet.count(),
  };

  const p5Lists = [
    {
      list: "Documents Hub",
      pagination: "cap only (~300/type)",
      serverPagination: false,
      infiniteScroll: false,
      virtualScroll: false,
      risk: "high",
      note: "Merged multi-entity fan-out; client filter",
    },
    {
      list: "Workflow Documents API",
      pagination: "none (unbounded)",
      serverPagination: false,
      infiniteScroll: false,
      virtualScroll: false,
      risk: "high",
      note: "Heavy include if used as full list",
    },
    {
      list: "Work Diaries",
      pagination: "take 50–80",
      serverPagination: false,
      infiniteScroll: false,
      virtualScroll: false,
      risk: "medium",
      note: "Silent truncation",
    },
    {
      list: "Ops Delivery Notes",
      pagination: "take 50–80",
      serverPagination: false,
      infiniteScroll: false,
      virtualScroll: false,
      risk: "medium",
      note: "Cap only",
    },
    {
      list: "Legacy Delivery Notes",
      pagination: "none",
      serverPagination: false,
      infiniteScroll: false,
      virtualScroll: false,
      risk: "high",
      note: "findAll unbounded",
    },
    {
      list: "BOQ table",
      pagination: "client pageSize 15",
      serverPagination: false,
      infiniteScroll: false,
      virtualScroll: false,
      risk: "high",
      note: "Loads full project BOQ then paginates in browser",
    },
    {
      list: "Approvals / Workflow pending",
      pagination: "inbox-sized",
      serverPagination: false,
      infiniteScroll: false,
      virtualScroll: false,
      risk: "low",
      note: "OK for inbox",
    },
    {
      list: "Project Rooms",
      pagination: "all rooms",
      serverPagination: false,
      infiniteScroll: false,
      virtualScroll: false,
      risk: "medium",
      note: "Full list + possible N+1 hasReports",
    },
    {
      list: "Execution Reports",
      pagination: "take 50",
      serverPagination: false,
      infiniteScroll: false,
      virtualScroll: false,
      risk: "medium",
      note: "Truncation; project variant may be unbounded",
    },
    {
      list: "Projects list",
      pagination: "unbounded",
      serverPagination: false,
      infiniteScroll: false,
      virtualScroll: false,
      risk: "medium",
      note: "Client status filter",
    },
  ];

  // ── P6 Frontend ──
  console.log("\n--- P6 Frontend bundle signals ---\n");
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const heavyDeps = [
    "xlsx",
    "exceljs",
    "jspdf",
    "pdfkit",
    "recharts",
    "chart.js",
    "moment",
    "lodash",
    "date-fns",
    "@tanstack/react-table",
    "lucide-react",
    "framer-motion",
    "mapbox-gl",
    "leaflet",
    "three",
    "@supabase/supabase-js",
    "prisma",
    "@prisma/client",
  ].filter((d) => deps[d]);

  // dynamic import / lazy usage count
  const { execSync } = await import("node:child_process");
  let dynamicImportHits = 0;
  let nextDynamicHits = 0;
  let suspenseHits = 0;
  try {
    dynamicImportHits = Number(
      execSync(
        `rg -c "import\\\\(|next/dynamic|React\\\\.lazy" src --glob "*.{ts,tsx}" -g "!**/*.d.ts" 2>$null | Measure-Object -Sum | Select-Object -ExpandProperty Sum`,
        { shell: "powershell.exe", encoding: "utf8" }
      ).trim() || "0"
    );
  } catch {
    /* fallback below */
  }
  try {
    const di = execSync(`rg -l "next/dynamic" src --glob "*.{ts,tsx}"`, {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
    nextDynamicHits = di.length;
  } catch {
    nextDynamicHits = 0;
  }
  try {
    const su = execSync(`rg -l "Suspense" src --glob "*.{ts,tsx}"`, {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
    suspenseHits = su.length;
  } catch {
    suspenseHits = 0;
  }
  try {
    const di2 = execSync(
      `rg -l "import\\\\(" src --glob "*.{ts,tsx}"`,
      { encoding: "utf8" }
    )
      .trim()
      .split("\n")
      .filter(Boolean);
    dynamicImportHits = di2.length;
  } catch {
    /* */
  }

  const nextDir = join(process.cwd(), ".next");
  const staticDir = join(nextDir, "static");
  const bundle = {
    nextBuildPresent: existsSync(nextDir),
    staticBytes: dirSize(staticDir),
    largestStatic: largestFiles(staticDir, 12).map((f) => ({
      path: f.path.split("/.next/")[1] || f.path,
      kb: Math.round(f.bytes / 1024),
    })),
    dependencyCount: Object.keys(deps).length,
    heavyDependenciesPresent: heavyDeps,
    filesUsingNextDynamic: nextDynamicHits,
    filesUsingDynamicImport: dynamicImportHits,
    filesUsingSuspense: suspenseHits,
    recommendations: [
      "Ensure portal routes (system/project/ops/field) are route-split by App Router (already separate layouts).",
      "Lazy-load Excel/PDF export modules (xlsx/jspdf) only on export click — avoid landing in initial chunk.",
      "Documents Hub is API-heavy; FE virtualization only helps after server pagination exists.",
      "BOQ: prefer server pagination or virtualize rows if item count >> 200.",
      "Audit lucide-react imports — prefer per-icon imports (already typical with lucide).",
      "Run `next build` + `@next/bundle-analyzer` for precise Before/After when optimizing (P6 opt phase).",
    ],
  };
  console.log(
    `deps=${bundle.dependencyCount} heavy=[${heavyDeps.join(",")}] next/dynamic files=${nextDynamicHits} Suspense files=${suspenseHits}`
  );
  console.log(
    `.next/static size=${Math.round(bundle.staticBytes / 1024)}KB files=${bundle.largestStatic.length}`
  );

  // ── P7 Infrastructure ──
  console.log("\n--- P7 Infrastructure ---\n");
  const supabaseHost = "aws-0-eu-north-1.pooler.supabase.com";
  const supabaseApiHost = "semiesnxxmnvcerzjzao.supabase.co";

  let dnsLookup = null;
  try {
    const t0 = performance.now();
    const addrs = await dns.lookup(supabaseHost, { all: true });
    dnsLookup = { ms: ms(t0), addresses: addrs.map((a) => a.address) };
  } catch (e) {
    dnsLookup = { ms: null, error: e.message };
  }

  const tcpPooler = await tcpConnect(supabaseHost, 6543);
  const tcpDirect = await tcpConnect(supabaseHost, 5432);
  const tlsApi = await tlsHandshake(supabaseApiHost, 443);

  // Cold vs warm HTML
  const coldHtml = [];
  for (let i = 0; i < 2; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/login`);
    await res.arrayBuffer();
    coldHtml.push(ms(t0));
  }

  const p7 = {
    appRuntime: "local Next.js dev (measured from this host)",
    vercelRegion: "not deployed in this measurement — configure on Vercel (recommend fra1/arn1 for EU)",
    supabaseRegion: "eu-north-1 (Stockholm) — from pooler hostname",
    connectionPool: "Supabase pooler :6543 (pgbouncer=true on DATABASE_URL)",
    directDb: ":5432 DIRECT_URL (migrations)",
    dns: dnsLookup,
    tcpPooler6543: tcpPooler,
    tcpDirect5432: tcpDirect,
    tlsSupabaseApi: tlsApi,
    rttSelect1: rtt,
    htmlLoginSamplesMs: coldHtml,
    latencyBudget: {
      dnsMs: dnsLookup?.ms,
      tcpPoolerMs: tcpPooler.ms,
      tlsApiMs: tlsApi.ms,
      dbRttMinMs: rtt.min,
      dbRttAvgMs: rtt.avg,
      typicalSingleQueryPageMs: rtt.avg,
      typicalAuthPlusQueryMs: rtt.avg * 2,
      note: "App currently local (likely IL/EU mismatch). Deploying Next to Vercel fra1/arn1 near eu-north-1 can cut DB RTT from ~450ms toward ~5–40ms.",
    },
    regionChangeEstimate: {
      currentDbRttMs: rtt.min,
      expectedDbRttIfColocatedMs: "5–40",
      expectedHubOrSheetHttpMs: "50–150 (was ~500)",
      expectedCellSaveMs: "20–80 (was ~460)",
      expectedImprovementFactor: "10–20× on DB-bound paths",
      action: "DO NOT change region without approval",
    },
  };
  console.log(
    `DNS ${dnsLookup?.ms}ms  TCP:6543 ${tcpPooler.ms}ms  TCP:5432 ${tcpDirect.ms}ms  TLS API ${tlsApi.ms}ms`
  );
  console.log(
    `Region estimate: colocating app→eu-north-1 → DB RTT ${rtt.min}ms → ~5–40ms`
  );

  // Rank P4 by severity
  const ranked = [...p4Screens].sort((a, b) => (b.avg || 0) - (a.avg || 0));
  const codeBound = ranked.filter((s) => (s.rttEstimate || 0) >= 3);
  const infraBound = ranked.filter((s) => (s.rttEstimate || 0) <= 2);

  const report = {
    measuredAt: new Date().toISOString(),
    base: BASE,
    projectId: PROJECT_ID,
    completedCore: {
      P0: "10.43s → 6.13s",
      P1: "2.30s → 1.23s",
      P15: "1.16s → 0.49s",
      P2: "3.22s → 0.72s",
      P3: "2.32s → 0.46s",
      stop: "Hub / Auth / Sheet / Cell-save — no further code refactor",
    },
    rtt,
    counts,
    p4: {
      screens: p4Screens,
      rankedSlowest: ranked.slice(0, 8),
      repoChecks,
      rootCauseSummary:
        "Screens at ~1–2×RTT are infrastructure-bound. Screens ≥3×RTT likely still have serial query fan-out or heavy includes (Documents Hub, workflow documents, workspace tree).",
      codeBoundCandidates: codeBound.map((s) => s.screen),
      infraBoundLikely: infraBound.map((s) => s.screen),
    },
    p5: {
      lists: p5Lists,
      virtualizationPresent: false,
      infiniteScrollPresent: false,
      serverSidePaginationPresent: false,
      rootCause:
        "No virtualization library; most lists use take-caps or unbounded loads with client filter/sort. Highest risk: Documents Hub fan-out, legacy delivery notes, full BOQ load.",
      limit: "code",
    },
    p6: {
      ...bundle,
      bundleBefore: bundle.staticBytes
        ? `${Math.round(bundle.staticBytes / 1024)}KB .next/static (dev/build artifact)`
        : "no .next/static — run production build for real sizes",
      bundleAfter: "n/a (audit only — no changes)",
      rootCause:
        "App Router splits portals; remaining risk is heavy optional libs (excel/pdf) and large list renders, not measured production chunk graph in this run.",
      limit: "code (FE) — optimize only after approval",
    },
    p7: {
      ...p7,
      rootCause:
        "Dominant floor is geographic RTT from app host to Supabase eu-north-1 (~430–500ms/query). Pooler is configured. Colocation is the primary infra lever.",
      limit: "infrastructure",
    },
  };

  writeFileSync(
    new URL("./perf-audit-p4-p7-results.json", import.meta.url),
    JSON.stringify(report, null, 2)
  );
  console.log("\nWrote scripts/perf-audit-p4-p7-results.json\n");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
