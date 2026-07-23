/**
 * Sprint 1 smoke: login → portal → key pages → logout
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PASS = "WegoAudit123!";

const ACCOUNTS = [
  { user: "sysmgr", home: "/system", checks: ["/system/workflow", "/system/documents", "/system/notifications"] },
  { user: "pm1", home: "/project", checks: ["/project/projects", "/project/approvals", "/project/boq"] },
  { user: "opsmgr", home: "/operations", checks: ["/operations/approvals", "/operations/workflow", "/operations/share-links"] },
  { user: "fieldmgr", home: "/field", checks: ["/field/work-diaries", "/field/documents", "/field/notifications"] },
];

const results = [];

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({ locale: "he-IL" });
const page = await ctx.newPage();

async function login(username) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[autocomplete="username"]', username);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
}

for (const acc of ACCOUNTS) {
  const row = { user: acc.user, ok: true, errors: [] };
  try {
    await ctx.clearCookies();
    await login(acc.user);
    if (!page.url().includes(acc.home.replace(/^\//, ""))) {
      row.ok = false;
      row.errors.push(`redirect expected ${acc.home} got ${page.url()}`);
    }
    await page.reload({ waitUntil: "networkidle" });
    if (page.url().includes("/login")) {
      row.ok = false;
      row.errors.push("refresh lost session");
    }
    for (const path of acc.checks) {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      const status = res?.status() ?? 0;
      const body = await page.textContent("body");
      if (status >= 400 || /משהו השתבש|Unexpected/.test(body || "")) {
        row.ok = false;
        row.errors.push(`${path} status=${status} error-page`);
      }
    }
    // logout
    const logout = page.getByRole("button", { name: /יציאה/ });
    if (await logout.count()) {
      await logout.first().click();
      await page.waitForTimeout(800);
    }
  } catch (e) {
    row.ok = false;
    row.errors.push(e.message);
  }
  results.push(row);
  console.log(row.ok ? "OK" : "FAIL", acc.user, row.errors.join("; ") || "");
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
