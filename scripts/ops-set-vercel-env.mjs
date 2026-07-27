/**
 * Push required production env vars from .env.local to the linked Vercel project.
 * Never prints secret values — only names + lengths.
 *
 * Usage: node scripts/ops-set-vercel-env.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_FILE = resolve(ROOT, ".env.local");

const REQUIRED = [
  "SESSION_SECRET",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const OPTIONAL = ["DIRECT_URL", "AUTH_SECRET", "SENTRY_DSN", "CRON_SECRET"];

function parseEnv(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function addEnv(name, value, environment) {
  const r = spawnSync(
    "npx",
    ["vercel", "env", "add", name, environment, "--force"],
    {
      cwd: ROOT,
      input: value + "\n",
      encoding: "utf8",
      shell: true,
    }
  );
  if (r.status !== 0) {
    console.error(`FAIL ${name} (${environment}):`, (r.stderr || r.stdout || "").slice(0, 400));
    return false;
  }
  console.log(`OK ${name} → ${environment} (len=${value.length})`);
  return true;
}

if (!existsSync(ENV_FILE)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const env = parseEnv(readFileSync(ENV_FILE, "utf8"));
const missing = REQUIRED.filter((k) => !env[k]?.trim());
if (missing.length) {
  console.error("Missing required keys in .env.local:", missing.join(", "));
  process.exit(1);
}

const targets = ["production", "preview", "development"];
let failed = 0;

for (const name of REQUIRED) {
  for (const target of targets) {
    if (!addEnv(name, env[name], target)) failed++;
  }
}

for (const name of OPTIONAL) {
  if (!env[name]?.trim()) {
    console.log(`SKIP ${name} (not set locally)`);
    continue;
  }
  for (const target of targets) {
    if (!addEnv(name, env[name], target)) failed++;
  }
}

console.log(failed ? `Done with ${failed} failures` : "All env vars pushed");
process.exit(failed ? 1 : 0);
