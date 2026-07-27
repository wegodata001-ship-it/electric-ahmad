/**
 * Add SESSION_SECRET from .env.local to the linked Vercel project (prod+preview).
 * Does not print the secret value.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const t = readFileSync(".env.local", "utf8");
const m = t.match(/^SESSION_SECRET=(.*)$/m);
if (!m) {
  console.error("SESSION_SECRET missing in .env.local");
  process.exit(1);
}
const value = m[1].trim().replace(/^["']|["']$/g, "");
if (value.length < 32 || /change-me/i.test(value)) {
  console.error("SESSION_SECRET invalid (len or placeholder)");
  process.exit(1);
}

let failed = 0;
for (const env of ["production", "preview"]) {
  const r = spawnSync(
    "npx",
    ["vercel", "env", "add", "SESSION_SECRET", env, "--force"],
    { input: value + "\n", encoding: "utf8", shell: true }
  );
  if (r.status === 0) {
    console.log(`OK SESSION_SECRET → ${env} (len=${value.length})`);
  } else {
    failed++;
    console.error(`FAIL ${env}:`, (r.stderr || r.stdout || "").slice(0, 400));
  }
}
process.exit(failed ? 1 : 0);
