/**
 * Sprint 2 — Concurrent user load test (no k6 dependency).
 * Simulates N virtual users hitting critical authenticated endpoints.
 *
 * Usage:
 *   node scripts/ops-load-test.mjs
 *   BASE_URL=http://localhost:3000 VUS=10,25,50 node scripts/ops-load-test.mjs
 *
 * Does NOT auto-optimize. Reports bottlenecks only.
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PROJECT =
  process.env.PROJECT_ID || "cms034ch70002kz04wu99jp4h";
const USER = process.env.PERF_USER || "sysmgr";
const PASS = process.env.PERF_PASS || "WegoAudit123!";
const LEVELS = (process.env.VUS || "10,25,50,100,200")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter((n) => n > 0);

const PATHS = [
  "/api/health",
  "/api/documents/hub?take=50",
  `/api/projects/${PROJECT}/rooms`,
  `/api/invoices/workspace?projectId=${PROJECT}`,
  "/api/boq?take=50",
  "/api/work-diaries?take=80",
];

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1
  );
  return sorted[Math.max(0, idx)];
}

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!r.ok) throw new Error(`login ${r.status} ${(await r.text()).slice(0, 120)}`);
  return (r.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function vuLoop(cookie, durationMs) {
  const samples = [];
  let errors = 0;
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    const path = PATHS[Math.floor(Math.random() * PATHS.length)];
    const t0 = performance.now();
    try {
      const headers = path === "/api/health" ? {} : { Cookie: cookie };
      const r = await fetch(`${BASE}${path}`, { headers });
      const ms = Math.round(performance.now() - t0);
      await r.arrayBuffer();
      samples.push({ path, ms, status: r.status });
      if (!r.ok) errors++;
    } catch {
      errors++;
      samples.push({ path, ms: Math.round(performance.now() - t0), status: 0 });
    }
  }
  return { samples, errors };
}

async function runLevel(vus, durationMs = 20000) {
  const cookie = await login();
  const t0 = Date.now();
  const workers = Array.from({ length: vus }, () => vuLoop(cookie, durationMs));
  const results = await Promise.all(workers);
  const wallMs = Date.now() - t0;
  const samples = results.flatMap((r) => r.samples);
  const errors = results.reduce((a, b) => a + b.errors, 0);
  const times = samples.map((s) => s.ms).sort((a, b) => a - b);
  const avg = times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : null;

  return {
    vus,
    durationMs,
    wallMs,
    requests: samples.length,
    errors,
    errorRate: samples.length
      ? Number(((errors / samples.length) * 100).toFixed(2))
      : 100,
    avgMs: avg,
    p50: percentile(times, 50),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
    minMs: times[0] ?? null,
    maxMs: times[times.length - 1] ?? null,
    rps: samples.length
      ? Number(((samples.length / (wallMs / 1000))).toFixed(2))
      : 0,
  };
}

async function main() {
  // Preflight
  try {
    const h = await fetch(`${BASE}/api/health`);
    const body = await h.text();
    if (!h.ok) throw new Error(`health ${h.status}`);
    // Must look like our app readiness probe
    if (!body.includes('"db"') && !body.includes('"ok"')) {
      console.warn("WARN: /api/health shape unexpected — is the correct app on BASE_URL?");
    }
    await login();
  } catch (e) {
    console.error(`Preflight failed against ${BASE}:`, e.message);
    console.error("Start the app (npm run dev) and re-run.");
    process.exit(1);
  }

  const levels = [];
  for (const vus of LEVELS) {
    console.log(`\n=== ${vus} VUs (20s) ===`);
    const row = await runLevel(vus, 20000);
    levels.push(row);
    console.log(JSON.stringify(row));
    // Stop escalation if error rate catastrophic
    if (row.errorRate > 25) {
      console.warn("STOP: error rate > 25% — not escalating further without approval.");
      break;
    }
  }

  const report = {
    measuredAt: new Date().toISOString(),
    base: BASE,
    projectId: PROJECT,
    note:
      "App-level HTTP metrics only. CPU/Memory/DB connections require host metrics (Vercel/Supabase dashboards) — see report notes.",
    levels,
    bottlenecks: levels
      .filter((l) => l.p95 > 3000 || l.errorRate > 5)
      .map((l) => ({
        vus: l.vus,
        reason:
          l.errorRate > 5
            ? `errorRate ${l.errorRate}%`
            : `p95 ${l.p95}ms`,
      })),
  };

  writeFileSync(
    new URL("./ops-load-test-results.json", import.meta.url),
    JSON.stringify(report, null, 2)
  );
  console.log("\nWrote scripts/ops-load-test-results.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
