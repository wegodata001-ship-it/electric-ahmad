/**
 * Architecture audit screenshots:
 * System (wide Admin) + Project / Ops / Field (narrow Portal).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = join(process.cwd(), "scripts", "screenshots");

async function loginViaApi(context, username, password) {
  const res = await context.request.post(BASE + "/api/auth/login", {
    data: { username, password, rememberMe: false },
  });
  const json = await res.json();
  if (!res.ok() || !json?.success) {
    throw new Error(
      `login failed for ${username}: ${res.status()} ${JSON.stringify(json)}`
    );
  }
  return json.data;
}

async function shot(browser, job) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "he-IL",
  });
  const user = await loginViaApi(context, job.user, job.pass);
  const page = await context.newPage();
  await page.goto(BASE + job.path, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-app]", { timeout: 30000 });
  await page.waitForTimeout(1500);
  const dest = join(OUT, job.file);
  await page.screenshot({ path: dest, fullPage: false });
  const url = page.url();
  const root = page.locator("[data-app]").first();
  const dataApp = await root.getAttribute("data-app").catch(() => null);
  const dataLayout = await root.getAttribute("data-layout").catch(() => null);
  const mainMax = await page
    .locator("main")
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        width: Math.round(el.getBoundingClientRect().width),
        maxWidth: cs.maxWidth,
      };
    })
    .catch(() => null);
  await context.close();
  return {
    portal: job.file.replace(".png", ""),
    user: job.user,
    path: job.path,
    portalPath: user?.portalPath,
    dest,
    url,
    dataApp,
    dataLayout,
    expectLayout: job.expectLayout,
    mainMax,
    ok: dataLayout === job.expectLayout,
  };
}

async function main() {
  const { chromium } = await import("playwright");
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const jobs = [
    {
      user: "sysmgr",
      pass: "WegoAudit123!",
      path: "/system",
      file: "system-manager.png",
      expectLayout: "admin",
    },
    {
      user: "pm1",
      pass: "WegoAudit123!",
      path: "/project",
      file: "project-portal.png",
      expectLayout: "portal",
    },
    {
      user: "opsmgr",
      pass: "WegoAudit123!",
      path: "/operations",
      file: "operations-portal.png",
      expectLayout: "portal",
    },
    {
      user: "foreman1",
      pass: "Foreman123!",
      path: "/field",
      file: "field-portal.png",
      expectLayout: "portal",
    },
  ];

  const results = [];
  for (const job of jobs) {
    try {
      results.push(await shot(browser, job));
    } catch (e) {
      results.push({ ...job, error: String(e?.message || e), ok: false });
    }
  }

  await browser.close();
  writeFileSync(join(OUT, "layout-audit.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
