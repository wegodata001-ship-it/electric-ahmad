/**
 * P1.5 Auth audit — measure every stage. No app code changes.
 */
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || "http://localhost:3000";
const PROJECT_ID = process.argv[3] || "cms034ch70002kz04wu99jp4h";
const PASSWORD = process.env.PERF_PASSWORD || "WegoAudit123!";
const prisma = new PrismaClient();

const OFFICE_COOKIE = "wego_office_session";
const OFFICE_ROLES = new Set([
  "PROJECT_MANAGER",
  "OPERATIONS_MANAGER",
  "ADMIN",
  "SYSTEM_MANAGER",
  "מנהל מערכת",
  "admin",
]);

function ms(t0) {
  return Math.round(performance.now() - t0);
}

function getSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    "wego-dev-field-session-secret-change-me"
  );
}

function toBase64Url(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacSign(data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return toBase64Url(sig);
}

async function verifyHmacWeb(token) {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = await hmacSign(encoded);
  if (expected.length !== sig.length) return null;
  let ok = true;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== sig[i]) ok = false;
  }
  if (!ok) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded));
    const payload = JSON.parse(json);
    if (!OFFICE_ROLES.has(payload.role)) return null;
    if (!payload.userId) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function main() {
  const stages = [];
  const push = (name, elapsed, extra = {}) => {
    stages.push({ name, ms: elapsed, ...extra });
    console.log(
      `OK ${String(elapsed).padStart(6)}ms  ${name}` +
        (extra.queries != null ? `  q=${extra.queries}` : "")
    );
  };

  console.log("\n=== P1.5 Authentication Audit ===\n");

  // Login
  const tLogin = performance.now();
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sysmgr", password: PASSWORD }),
  });
  const setCookies = loginRes.headers.getSetCookie?.() || [];
  const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");
  const rawToken = setCookies
    .map((c) => c.split(";")[0])
    .find((p) => p.startsWith(`${OFFICE_COOKIE}=`))
    ?.slice(OFFICE_COOKIE.length + 1);
  push("Login API (context only)", ms(tLogin), { queries: null });

  if (!rawToken) throw new Error("no office session cookie");

  // --- Cookie / HMAC (mirrors verifyOfficeSession Web Crypto) ---
  const token = decodeURIComponent(rawToken);
  let payload = null;
  {
    const t0 = performance.now();
    payload = await verifyHmacWeb(token);
    push("Cookie parse + HMAC verify (Web Crypto)", ms(t0), {
      queries: 0,
      rtt: 0,
      ok: !!payload,
      role: payload?.role,
    });
  }
  {
    const times = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      await verifyHmacWeb(token);
      times.push(performance.now() - t0);
    }
    push(
      "HMAC verify x20 avg",
      Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      { queries: 0, rtt: 0 }
    );
  }

  // Fallback: resolve userId via /api/auth/me if local HMAC secret mismatch
  if (!payload) {
    const meRes = await fetch(`${BASE}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    const meJson = await meRes.json();
    if (!meJson.success) throw new Error("HMAC verify failed and /me failed");
    payload = { userId: meJson.data.id, role: meJson.data.role, exp: 0 };
    push("Fallback userId from /api/auth/me", 0, {
      queries: 1,
      note: "local SECRET mismatch with server; DB stages still valid",
    });
  }

  // --- DB stages matching requireOfficeUser ---
  {
    const t0 = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    push("RTT floor SELECT 1", ms(t0), { queries: 1, rtt: 1 });
  }

  {
    const t0 = performance.now();
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { employee: true },
    });
    push("requireOfficeUser: findUnique include employee (FULL)", ms(t0), {
      queries: 1,
      rtt: 1,
      hasEmployee: !!user?.employee,
      userKeys: user ? Object.keys(user).length : 0,
      employeeKeys: user?.employee ? Object.keys(user.employee).length : 0,
    });
  }

  {
    const t0 = performance.now();
    await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        avatarUrl: true,
        passwordHash: true,
        employee: {
          select: { id: true, isDeleted: true, status: true },
        },
      },
    });
    push("ALT: findUnique slim select (user+employee fields only)", ms(t0), {
      queries: 1,
      rtt: 1,
    });
  }

  {
    const t0 = performance.now();
    await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, passwordHash: true },
    });
    push("ALT: user only (no employee)", ms(t0), { queries: 1, rtt: 1 });
  }

  {
    const t0 = performance.now();
    const [u, e] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          avatarUrl: true,
          passwordHash: true,
        },
      }),
      prisma.employee.findFirst({
        where: { userId: payload.userId },
        select: { id: true, isDeleted: true, status: true },
      }),
    ]);
    push("ALT: user ‖ employee parallel (2 queries)", ms(t0), {
      queries: 2,
      rtt: 2,
      hasEmployee: !!e,
      userId: u?.id,
    });
  }

  {
    const t0 = performance.now();
    await prisma.$queryRaw`
      SELECT u.id, u.name, u.email, u.username, u.role, u."avatarUrl",
             (u."passwordHash" IS NOT NULL) AS has_password,
             e.id AS employee_id, e."isDeleted", e.status::text AS status
      FROM "User" u
      LEFT JOIN "Employee" e ON e."userId" = u.id
      WHERE u.id = ${payload.userId}
      LIMIT 1
    `;
    push("ALT: raw SQL user LEFT JOIN employee (1 query)", ms(t0), {
      queries: 1,
      rtt: 1,
    });
  }

  // Simulate double HMAC (proxy + route)
  {
    const t0 = performance.now();
    await verifyHmacWeb(token);
    await verifyHmacWeb(token);
    push("Double HMAC (proxy + requireOfficeUser)", ms(t0), {
      queries: 0,
      rtt: 0,
    });
  }

  // --- HTTP: /api/auth/me vs hub ---
  for (const label of ["HTTP /api/auth/me #1", "HTTP /api/auth/me #2"]) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    push(label, ms(t0), {
      queries: 1,
      status: res.status,
      bytes: buf.length,
    });
  }

  const hubSamples = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/projects/${PROJECT_ID}/hub`, {
      headers: { Cookie: cookieHeader },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const elapsed = ms(t0);
    hubSamples.push(elapsed);
    push(`HTTP hub #${i + 1} (auth+repo today)`, elapsed, {
      status: res.status,
      bytes: buf.length,
      queries: 2,
      rtt: 2,
    });
  }

  // Theoretical: fused auth+hub SQL (audit only — not wired)
  {
    const t0 = performance.now();
    const rows = await prisma.$queryRaw`
      SELECT p.id AS project_id, u.id AS user_id, u.role,
             (u."passwordHash" IS NOT NULL) AS has_password,
             e."isDeleted" AS emp_deleted, e.status::text AS emp_status,
             (SELECT COUNT(*)::int FROM "BoqItem" b
               WHERE b."projectId" = p.id AND b."deletedAt" IS NULL) AS boq_count
      FROM "Project" p
      CROSS JOIN "User" u
      LEFT JOIN "Employee" e ON e."userId" = u.id
      WHERE p.id = ${PROJECT_ID}
        AND u.id = ${payload.userId}
      LIMIT 1
    `;
    push("THEORY: fused auth gate + project probe (1 RTT)", ms(t0), {
      queries: 1,
      rtt: 1,
      rows: rows.length,
    });
  }

  // Full hub CTE + auth gate in one query (theory)
  {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      await prisma.$queryRaw`
        WITH auth AS (
          SELECT u.id, u.role, u.name, u.email, u.username, u."avatarUrl",
                 (u."passwordHash" IS NOT NULL) AS has_password,
                 e.id AS employee_id, e."isDeleted", e.status::text AS emp_status
          FROM "User" u
          LEFT JOIN "Employee" e ON e."userId" = u.id
          WHERE u.id = ${payload.userId}
        ),
        boq AS (
          SELECT COUNT(*)::int AS item_count
          FROM "BoqItem"
          WHERE "projectId" = ${PROJECT_ID} AND "deletedAt" IS NULL
        )
        SELECT a.id AS user_id, a.role, a.has_password, p.id AS project_id, boq.item_count
        FROM auth a
        CROSS JOIN "Project" p
        CROSS JOIN boq
        WHERE p.id = ${PROJECT_ID}
          AND a.has_password = true
          AND a.role IN ('PROJECT_MANAGER','SYSTEM_MANAGER','ADMIN','OPERATIONS_MANAGER','admin','מנהל מערכת')
          AND (a.employee_id IS NULL OR (a."isDeleted" = false AND a.emp_status = 'active'))
      `;
      samples.push(ms(t0));
    }
    push("THEORY: hub KPIs+auth gate fused (min of 3)", Math.min(...samples), {
      queries: 1,
      rtt: 1,
      samples,
    });
    push("THEORY: hub KPIs+auth gate fused (avg of 3)", Math.round(samples.reduce((a, b) => a + b, 0) / samples.length), {
      queries: 1,
      rtt: 1,
    });
  }

  const rtt = stages.find((s) => s.name.startsWith("RTT floor"))?.ms ?? 0;
  const authFull = stages.find((s) =>
    s.name.includes("include employee (FULL)")
  )?.ms;
  const authSlim = stages.find((s) => s.name.includes("slim select"))?.ms;
  const hubAvg = Math.round(
    hubSamples.reduce((a, b) => a + b, 0) / hubSamples.length
  );
  const theoryFused = stages.find((s) =>
    s.name.includes("hub KPIs+auth gate fused (avg")
  )?.ms;

  const breakdown = [
    {
      stage: "Cookie parse + HMAC",
      ms: stages.find((s) => s.name.startsWith("Cookie parse"))?.ms,
      queries: 0,
      rtt: 0,
    },
    {
      stage: "Proxy HMAC (duplicate of route)",
      ms: stages.find((s) => s.name.startsWith("Double HMAC"))?.ms,
      queries: 0,
      rtt: 0,
      note: "CPU only; runs before route",
    },
    {
      stage: "user.findUnique include employee",
      ms: authFull,
      queries: 1,
      rtt: 1,
    },
    {
      stage: "Role / permission / tenant / org lookup",
      ms: 0,
      queries: 0,
      rtt: 0,
      note: "None — role is column on User; no tenant/org tables in path",
    },
    {
      stage: "Supabase Auth API",
      ms: 0,
      queries: 0,
      rtt: 0,
      note: "Not used — local HMAC cookie + Prisma Postgres",
    },
    {
      stage: "Hub repository SQL (P1)",
      ms: Math.max(0, hubAvg - (authFull || 0)),
      queries: 1,
      rtt: 1,
      note: "Estimated as HTTP − auth query (approx)",
    },
    {
      stage: "HTTP hub total (measured)",
      ms: hubAvg,
      queries: 2,
      rtt: 2,
    },
  ];

  const out = {
    measuredAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    dbHost: (process.env.DATABASE_URL || "")
      .replace(/:[^:@]+@/, ":***@")
      .split("@")[1]
      ?.split("/")[0],
    stages,
    breakdown,
    summary: {
      rttFloorMs: rtt,
      authFullIncludeMs: authFull,
      authSlimSelectMs: authSlim,
      hubHttpAvgMs: hubAvg,
      hubHttpMinMs: Math.min(...hubSamples),
      theoryFusedAuthHubAvgMs: theoryFused,
      queriesOnHubToday: 2,
      queriesIfFused: 1,
      codeSaveableMsEstimate: Math.max(
        0,
        hubAvg - (theoryFused || rtt) - 50
      ),
      irreducibleLatencyMs: rtt,
      canBeat1sWithCodeOnly:
        (theoryFused || 9999) < 1000 && (theoryFused || 9999) + 80 < 1000,
    },
    findings: {
      duplicateHmac: "proxy + requireOfficeUser both verify cookie (no DB)",
      duplicateUserFetch: "Not within single hub request — only once",
      middlewareDb: "proxy has 0 DB queries",
      overFetch: "include employee loads full Employee row; only id/status/isDeleted needed",
      noTenantOrg: true,
      noSupabaseAuthApi: true,
    },
  };

  console.log("\n=== BREAKDOWN ===");
  for (const b of breakdown) {
    console.log(
      `${String(b.ms ?? "-").padStart(6)}ms  q=${b.queries}  rtt=${b.rtt}  ${b.stage}` +
        (b.note ? `  (${b.note})` : "")
    );
  }
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(out.summary, null, 2));

  writeFileSync(
    new URL("./perf-audit-auth-p15-results.json", import.meta.url),
    JSON.stringify(out, null, 2)
  );
  console.log("\nWrote scripts/perf-audit-auth-p15-results.json");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
