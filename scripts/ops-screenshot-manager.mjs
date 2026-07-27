/**
 * Login as sysmgr + pm1 and screenshot manager portals.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = join(process.cwd(), "scripts", "screenshots");

async function login(page, username, password) {
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 30000 });
  await page.fill('input[autocomplete="username"]', username);
  await page.fill('input[autocomplete="current-password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30000,
  });
  await page.waitForTimeout(1000);
}

async function main() {
  const { chromium } = await import("playwright");
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const job of [
    { user: "sysmgr", pass: "WegoAudit123!", path: "/system", file: "system-manager.png" },
    { user: "pm1", pass: "WegoAudit123!", path: "/project", file: "project-manager.png" },
  ]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "he-IL",
    });
    const page = await context.newPage();
    await login(page, job.user, job.pass);
    await page.goto(BASE + job.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const dest = join(OUT, job.file);
    await page.screenshot({ path: dest, fullPage: false });
    const title = await page.locator("h1").first().textContent().catch(() => "");
    const body = await page.locator("[data-app]").first().getAttribute("data-app").catch(() => "");
    results.push({ ...job, dest, title: title?.trim(), dataApp: body, url: page.url() });
    await context.close();
  }

  await browser.close();
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
