/**
 * Validate P4.1–P4.3 + P5 list endpoints (avg of warm samples).
 */
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PROJECT = process.env.PROJECT_ID || "cms034ch70002kz04wu99jp4h";
const USER = process.env.PERF_USER || "sysmgr";
const PASS = process.env.PERF_PASS || "WegoAudit123!";

const BEFORE = {
  rooms: 4066,
  documentsHub: 2075,
  documentsArchive: 2758,
  invoiceWorkspace: 2664,
  deliveryNotesFull: 1177,
  boqAll: null,
};

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!r.ok) throw new Error(`login ${r.status}`);
  return (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
}

async function measure(cookie, path, samples = 3) {
  const times = [];
  let bytes = 0;
  let status = 0;
  let body = "";
  for (let i = 0; i < samples + 1; i++) {
    const t0 = performance.now();
    const r = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
    body = await r.text();
    status = r.status;
    const ms = Math.round(performance.now() - t0);
    if (i > 0) times.push(ms);
    if (i === 1) bytes = Buffer.byteLength(body);
  }
  let data = null;
  try {
    data = JSON.parse(body)?.data;
  } catch {
    /* ignore */
  }
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  return {
    path,
    status,
    avg,
    min: Math.min(...times),
    bytes,
    itemLen: Array.isArray(data)
      ? data.length
      : (data?.items?.length ?? null),
    pageInfo: data?.pageInfo ?? null,
    ok: status === 200,
  };
}

function imp(before, after) {
  if (before == null || after == null) return null;
  return Math.round(((before - after) / before) * 100);
}

const cookie = await login();
const rows = [];
const targets = [
  { key: "rooms", path: `/api/projects/${PROJECT}/rooms`, before: BEFORE.rooms },
  { key: "documentsHub", path: `/api/documents/hub?take=50`, before: BEFORE.documentsHub },
  {
    key: "documentsArchive",
    path: `/api/documents-archive`,
    before: BEFORE.documentsArchive,
  },
  {
    key: "invoiceWorkspace",
    path: `/api/invoices/workspace?projectId=${PROJECT}`,
    before: BEFORE.invoiceWorkspace,
  },
  {
    key: "deliveryNotesPaged",
    path: `/api/delivery-notes?take=40`,
    before: BEFORE.deliveryNotesFull,
  },
  { key: "boqPaged", path: `/api/boq?take=50`, before: null },
  { key: "workDiaries", path: `/api/work-diaries?take=80`, before: null },
];

for (const t of targets) {
  const m = await measure(cookie, t.path);
  rows.push({
    ...m,
    before: t.before,
    improvementPct: imp(t.before, m.avg),
    key: t.key,
  });
  console.log(
    JSON.stringify({
      key: t.key,
      before: t.before,
      after: m.avg,
      imp: imp(t.before, m.avg),
      status: m.status,
      bytes: m.bytes,
      pageInfo: m.pageInfo,
    })
  );
}

const out = {
  measuredAt: new Date().toISOString(),
  base: BASE,
  projectId: PROJECT,
  rows,
};
writeFileSync(
  new URL("./perf-validate-p4-p5-results.json", import.meta.url),
  JSON.stringify(out, null, 2)
);
console.log("wrote scripts/perf-validate-p4-p5-results.json");
