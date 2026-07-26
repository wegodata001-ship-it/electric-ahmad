/**
 * Read-only Performance Audit harness.
 * Measures real HTTP timings against local Next.js. Does not modify app code.
 *
 * Usage: node scripts/perf-audit-measure.mjs [baseUrl]
 */
import { performance } from "node:perf_hooks";

const BASE = process.argv[2] || "http://localhost:3000";
const PASSWORD = process.env.PERF_PASSWORD || "WegoAudit123!";

const results = [];

function cookieJar() {
  const jar = new Map();
  return {
    store(res) {
      const raw = res.headers.getSetCookie?.() || [];
      for (const c of raw) {
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

async function timed(name, fn, meta = {}) {
  const t0 = performance.now();
  try {
    const out = await fn();
    const ms = Math.round(performance.now() - t0);
    results.push({
      action: name,
      ok: true,
      totalMs: ms,
      status: out?.status ?? null,
      bytes: out?.bytes ?? null,
      detail: out?.detail ?? null,
      ...meta,
    });
    process.stdout.write(`OK  ${String(ms).padStart(6)}ms  ${name}\n`);
    return out;
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    results.push({
      action: name,
      ok: false,
      totalMs: ms,
      error: e.message,
      ...meta,
    });
    process.stdout.write(`ERR ${String(ms).padStart(6)}ms  ${name} — ${e.message}\n`);
    return null;
  }
}

async function req(jar, path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const cookie = jar.header();
  if (cookie) headers.Cookie = cookie;
  if (opts.json) {
    headers["Content-Type"] = "application/json";
  }
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.json ? JSON.stringify(opts.json) : opts.body,
    redirect: "manual",
  });
  jar.store(res);
  const buf = Buffer.from(await res.arrayBuffer());
  const ms = Math.round(performance.now() - t0);
  let json = null;
  try {
    json = JSON.parse(buf.toString("utf8"));
  } catch {
    /* html or empty */
  }
  return {
    status: res.status,
    bytes: buf.length,
    ms,
    json,
    detail: `http=${res.status} bytes=${buf.length}`,
  };
}

async function login(jar, username, portal) {
  return timed(`Login API (${username} → ${portal})`, async () => {
    // Try office login first, then field
    let r = await req(jar, "/api/auth/login", {
      method: "POST",
      json: { username, password: PASSWORD },
    });
    if (r.status >= 400) {
      r = await req(jar, "/api/field/auth/login", {
        method: "POST",
        json: { username, password: PASSWORD },
      });
    }
    if (r.status >= 400) throw new Error(`login failed ${r.status}`);
    return r;
  }, { layer: "api", portal });
}

async function main() {
  console.log(`\n=== Performance Audit Measure ===`);
  console.log(`Base: ${BASE}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Cold HTML pages
  const coldJar = cookieJar();
  await timed("GET /login (HTML cold)", () => req(coldJar, "/login"), {
    layer: "frontend",
  });
  await timed("GET /login (HTML warm)", () => req(coldJar, "/login"), {
    layer: "frontend",
  });

  // System manager
  const sys = cookieJar();
  await login(sys, "sysmgr", "system");
  await timed("GET /api/projects", () => req(sys, "/api/projects"), {
    layer: "api",
  });
  await timed("GET /api/projects (2nd)", () => req(sys, "/api/projects"), {
    layer: "api",
  });
  await timed("GET /api/documents?recent=5", () =>
    req(sys, "/api/documents?recent=5")
  , { layer: "api" });
  await timed("GET /api/approvals/pending", () =>
    req(sys, "/api/approvals/pending")
  , { layer: "api" });
  await timed("GET /api/documents/hub", () => req(sys, "/api/documents/hub"), {
    layer: "api",
  });
  await timed("GET /api/documents-archive", () =>
    req(sys, "/api/documents-archive")
  , { layer: "api" });
  await timed("GET /api/notifications (or unread)", async () => {
    let r = await req(sys, "/api/notifications");
    if (r.status >= 400) r = await req(sys, "/api/notifications/unread");
    return r;
  }, { layer: "api" });
  await timed("GET /api/system/settings", () =>
    req(sys, "/api/system/settings")
  , { layer: "api" });
  await timed("GET /system (HTML)", () => req(sys, "/system"), {
    layer: "frontend",
  });
  await timed("GET /project (HTML)", () => req(sys, "/project"), {
    layer: "frontend",
  });
  await timed("GET /operations (HTML)", () => req(sys, "/operations"), {
    layer: "frontend",
  });

  // Resolve a project id
  const projectsRes = await req(sys, "/api/projects");
  const projects = Array.isArray(projectsRes.json?.data)
    ? projectsRes.json.data
    : Array.isArray(projectsRes.json)
      ? projectsRes.json
      : projectsRes.json?.data?.items || [];
  const projectId = projects[0]?.id;
  console.log(`\nUsing projectId=${projectId || "(none)"}\n`);

  if (projectId) {
    await timed("GET /api/projects/:id", () =>
      req(sys, `/api/projects/${projectId}`)
    , { layer: "api" });
    await timed("GET /api/projects/:id/hub", () =>
      req(sys, `/api/projects/${projectId}/hub`)
    , { layer: "api" });
    await timed("GET BOQ by project", () =>
      req(sys, `/api/boq?projectId=${projectId}`)
    , { layer: "api" });
    await timed("GET measurement-sheets list", () =>
      req(sys, `/api/measurement-sheets?projectId=${projectId}`)
    , { layer: "api" });
    await timed("GET documents by project", () =>
      req(sys, `/api/documents?projectId=${projectId}`)
    , { layer: "api" });
    await timed("GET documents hub filtered", () =>
      req(sys, `/api/documents/hub?projectId=${projectId}`)
    , { layer: "api" });
    await timed("GET invoices workspace tree?", async () => {
      let r = await req(sys, `/api/invoices/workspace?projectId=${projectId}`);
      if (r.status >= 400) {
        r = await req(sys, `/api/projects/${projectId}/hub`);
      }
      return r;
    }, { layer: "api" });

    // Measurement sheet detail (heaviest candidate)
    const sheetsRes = await req(
      sys,
      `/api/measurement-sheets?projectId=${projectId}`
    );
    const sheets =
      sheetsRes.json?.data?.items ||
      sheetsRes.json?.items ||
      sheetsRes.json?.data ||
      [];
    const sheetId = sheets[0]?.id;
    if (sheetId) {
      console.log(`Using sheetId=${sheetId}\n`);
      await timed("GET measurement-sheet/:id (cold)", () =>
        req(sys, `/api/measurement-sheets/${sheetId}`)
      , { layer: "api" });
      await timed("GET measurement-sheet/:id (warm)", () =>
        req(sys, `/api/measurement-sheets/${sheetId}`)
      , { layer: "api" });
      await timed("GET print/measurement-sheets/:id HTML", () =>
        req(sys, `/print/measurement-sheets/${sheetId}`)
      , { layer: "frontend" });
      // Cell save simulation — read first cell if any
      const sheet = (
        await req(sys, `/api/measurement-sheets/${sheetId}`)
      ).json?.data;
      const cell = sheet?.cells?.[0];
      if (cell) {
        await timed("PUT cells single (same value)", () =>
          req(sys, `/api/measurement-sheets/${sheetId}/cells`, {
            method: "PUT",
            json: {
              rowId: cell.rowId,
              boqItemId: cell.boqItemId,
              quantity: Number(cell.quantity) || 0,
            },
          })
        , { layer: "api" });
        await timed("PUT cells batch (1 cell)", () =>
          req(sys, `/api/measurement-sheets/${sheetId}/cells`, {
            method: "PUT",
            json: {
              cells: [
                {
                  rowId: cell.rowId,
                  boqItemId: cell.boqItemId,
                  quantity: Number(cell.quantity) || 0,
                },
              ],
            },
          })
        , { layer: "api" });
      }
    }

    // Partial invoices
    await timed("GET partial-invoices?", async () => {
      let r = await req(sys, `/api/partial-invoices?projectId=${projectId}`);
      if (r.status >= 400) r = await req(sys, `/api/invoices?projectId=${projectId}`);
      return r;
    }, { layer: "api" });
  }

  // Project portal user
  const pm = cookieJar();
  await login(pm, "pm1", "project");
  await timed("pm1 GET /api/approvals/pending", () =>
    req(pm, "/api/approvals/pending")
  , { layer: "api", portal: "project" });
  await timed("pm1 GET /api/documents/hub", () =>
    req(pm, "/api/documents/hub")
  , { layer: "api", portal: "project" });

  // Ops
  const ops = cookieJar();
  await login(ops, "opsmgr", "operations");
  await timed("opsmgr GET /api/approvals/pending", () =>
    req(ops, "/api/approvals/pending")
  , { layer: "api", portal: "operations" });
  await timed("opsmgr GET /api/operations/attendance?", async () => {
    let r = await req(ops, "/api/operations/attendance");
    if (r.status >= 400) r = await req(ops, "/api/approvals/pending");
    return r;
  }, { layer: "api", portal: "operations" });

  // Field
  const field = cookieJar();
  await login(field, "fieldmgr", "field");
  await timed("fieldmgr GET /api/field/me", () => req(field, "/api/field/me"), {
    layer: "api",
    portal: "field",
  });
  await timed("fieldmgr GET work diaries", () =>
    req(field, "/api/field/work-diaries")
  , { layer: "api", portal: "field" });
  await timed("fieldmgr GET ops delivery notes", () =>
    req(field, "/api/field/ops-delivery-notes")
  , { layer: "api", portal: "field" });
  await timed("fieldmgr GET work orders", async () => {
    let r = await req(field, "/api/field/work-orders");
    if (r.status >= 400) r = await req(field, "/api/work-orders");
    return r;
  }, { layer: "api", portal: "field" });
  await timed("GET /field (HTML)", () => req(field, "/field"), {
    layer: "frontend",
    portal: "field",
  });

  // Waterfall simulation: dashboard-like parallel vs serial
  if (projectId) {
    await timed("SERIAL waterfall: projects→sheet→boq→docs", async () => {
      await req(sys, "/api/projects");
      const s = await req(sys, `/api/measurement-sheets?projectId=${projectId}`);
      const items = s.json?.data?.items || s.json?.items || [];
      if (items[0]?.id) await req(sys, `/api/measurement-sheets/${items[0].id}`);
      await req(sys, `/api/boq?projectId=${projectId}`);
      await req(sys, `/api/documents?projectId=${projectId}`);
      return { status: 200, bytes: 0, detail: "serial 4-5 calls" };
    }, { layer: "waterfall" });

    await timed("PARALLEL Promise.all same set", async () => {
      await Promise.all([
        req(sys, "/api/projects"),
        req(sys, `/api/measurement-sheets?projectId=${projectId}`),
        req(sys, `/api/boq?projectId=${projectId}`),
        req(sys, `/api/documents?projectId=${projectId}`),
      ]);
      return { status: 200, bytes: 0, detail: "parallel 4 calls" };
    }, { layer: "waterfall" });

    // P0 FE journey: open accounts project + measurement sheet (known ids)
    const sheetsForJourney = await req(
      sys,
      `/api/measurement-sheets?projectId=${projectId}`
    );
    const journeySheets =
      sheetsForJourney.json?.data?.items ||
      sheetsForJourney.json?.items ||
      sheetsForJourney.json?.data ||
      [];
    const journeySheetId = journeySheets[0]?.id;

    await timed(
      "P0 OLD journey: me→me→workspace→tree→sheets→boq→sheet",
      async () => {
        await req(sys, "/api/auth/me");
        await req(sys, "/api/auth/me");
        await req(sys, "/api/invoices/workspace");
        await req(sys, `/api/invoices/workspace?projectId=${projectId}`);
        await req(sys, `/api/measurement-sheets?projectId=${projectId}`);
        await req(sys, `/api/boq?projectId=${projectId}`);
        if (journeySheetId) {
          await req(sys, `/api/measurement-sheets/${journeySheetId}`);
        }
        return { status: 200, bytes: 0, detail: "pre-P0 serial FE path" };
      },
      { layer: "waterfall" }
    );

    await timed(
      "P0 NEW journey: me + (workspace‖tree) + (sheets‖boq‖sheet)",
      async () => {
        await req(sys, "/api/auth/me");
        await Promise.all([
          req(sys, "/api/invoices/workspace"),
          req(sys, `/api/invoices/workspace?projectId=${projectId}`),
        ]);
        await Promise.all([
          req(sys, `/api/measurement-sheets?projectId=${projectId}`),
          req(sys, `/api/boq?projectId=${projectId}`),
          journeySheetId
            ? req(sys, `/api/measurement-sheets/${journeySheetId}`)
            : Promise.resolve(null),
        ]);
        return { status: 200, bytes: 0, detail: "post-P0 parallel FE path" };
      },
      { layer: "waterfall" }
    );

    await timed(
      "P0 docs hub: projects‖hub (parallel)",
      async () => {
        await Promise.all([
          req(sys, "/api/projects"),
          req(sys, "/api/documents/hub"),
        ]);
        return { status: 200, bytes: 0, detail: "docs hub bootstrap" };
      },
      { layer: "waterfall" }
    );

    await timed(
      "P0 docs hub OLD: projects→hub (serial)",
      async () => {
        await req(sys, "/api/projects");
        await req(sys, "/api/documents/hub");
        return { status: 200, bytes: 0, detail: "docs hub serial" };
      },
      { layer: "waterfall" }
    );
  }

  // Summary
  const sorted = [...results].sort((a, b) => b.totalMs - a.totalMs);
  console.log("\n=== TOP SLOWEST ===");
  for (const r of sorted.slice(0, 20)) {
    console.log(
      `${String(r.totalMs).padStart(6)}ms  ${r.ok ? "OK" : "ERR"}  ${r.action}  ${r.bytes != null ? r.bytes + "B" : ""} ${r.detail || r.error || ""}`
    );
  }

  const outPath = new URL("./perf-audit-results.json", import.meta.url);
  const fs = await import("node:fs");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        base: BASE,
        measuredAt: new Date().toISOString(),
        results,
        topSlow: sorted.slice(0, 30),
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${outPath.pathname}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
