import { chromium } from "playwright-core";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "p1-ux-screenshots");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PASS = "WegoAudit123!";

const shots = [
  ["sysmgr", "/system/companies", "system-breadcrumb"],
  ["pm1", "/project/boq", "project-breadcrumb"],
  ["opsmgr", "/operations/approvals", "operations-breadcrumb"],
  ["fieldmgr", "/field/work-diaries", "field-breadcrumb"],
];

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext({
  locale: "he-IL",
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

async function login(username) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[autocomplete="username"]', username);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
}

for (const [user, path, name] of shots) {
  await ctx.clearCookies();
  await login(user);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  console.log("ok", name, path);
}

await browser.close();
