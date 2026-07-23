/**
 * P1 UX screenshots — Login → Portal → Desktop/Tablet/Mobile/Drawer
 * Usage: node scripts/p1-ux-screenshots.mjs
 */
import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "docs", "p1-ux-screenshots");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.P1_UX_PASSWORD || "WegoAudit123!";

const ACCOUNTS = [
  { key: "system", user: "sysmgr", path: "/system" },
  { key: "project", user: "pm1", path: "/project" },
  { key: "operations", user: "opsmgr", path: "/operations" },
  { key: "field", user: "fieldmgr", path: "/field" },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile360: { width: 360, height: 740 },
  mobile390: { width: 390, height: 844 },
  mobile430: { width: 430, height: 932 },
};

async function login(page, username) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[autocomplete="username"]', username);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
}

async function logout(page) {
  const btn = page.getByRole("button", { name: /יציאה/ });
  if (await btn.count()) {
    await btn.first().click();
    await page.waitForURL("**/login**", { timeout: 10000 }).catch(() => {});
  } else {
    await page.context().clearCookies();
    await page.goto(`${BASE}/login`);
  }
}

async function shot(page, name) {
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

async function ensureOpsUser() {
  // best-effort: opsmgr may not exist — try login later
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  await ensureOpsUser();

  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const context = await browser.newContext({ locale: "he-IL" });
  const page = await context.newPage();

  // Login screen
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await shot(page, "login-desktop");

  for (const acc of ACCOUNTS) {
    try {
      await page.setViewportSize(VIEWPORTS.desktop);
      await context.clearCookies();
      await login(page, acc.user);
      await page.goto(`${BASE}${acc.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      // Refresh stay
      await page.reload({ waitUntil: "networkidle" });
      if (!page.url().includes(acc.path.split("/")[1])) {
        console.warn("REFRESH FAIL", acc.key, page.url());
      }

      await shot(page, `${acc.key}-desktop`);

      // Navigate to second nav item for breadcrumb
      const navLinks = page.locator("aside nav a");
      if ((await navLinks.count()) > 1) {
        await navLinks.nth(1).click();
        await page.waitForTimeout(400);
        await shot(page, `${acc.key}-breadcrumb`);
        await page.goto(`${BASE}${acc.path}`, { waitUntil: "networkidle" });
      }

      await page.setViewportSize(VIEWPORTS.tablet);
      await page.goto(`${BASE}${acc.path}`, { waitUntil: "networkidle" });
      await shot(page, `${acc.key}-tablet-768`);

      for (const [label, vp] of [
        ["360", VIEWPORTS.mobile360],
        ["390", VIEWPORTS.mobile390],
        ["430", VIEWPORTS.mobile430],
      ]) {
        await page.setViewportSize(vp);
        await page.goto(`${BASE}${acc.path}`, { waitUntil: "networkidle" });
        await shot(page, `${acc.key}-mobile-${label}`);
        // Open drawer
        const menu = page.getByRole("button", { name: "תפריט" });
        if (await menu.count()) {
          await menu.click();
          await page.waitForTimeout(300);
          await shot(page, `${acc.key}-drawer-${label}`);
          // close overlay
          await page.locator('button[aria-label="סגור תפריט"]').click().catch(() => {});
        }
      }

      await page.setViewportSize(VIEWPORTS.desktop);
      await logout(page);
      await shot(page, `${acc.key}-after-logout`);
    } catch (err) {
      console.error("SKIP/FAIL", acc.key, err.message);
      await context.clearCookies();
    }
  }

  await browser.close();
  console.log("Done →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
