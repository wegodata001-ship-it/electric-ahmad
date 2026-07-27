/**
 * Restore manager portal UI files from pre-security baseline b179a69.
 * Does NOT touch security/auth/session/storage modules.
 */
import { execSync } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  unlinkSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { dirname, join } from "node:path";

const BASE = "b179a69";
const ROOT = process.cwd();

const RESTORE = [
  "src/app/(portals)/project/accounts/page.tsx",
  "src/app/(portals)/project/boq/page.tsx",
  "src/app/(portals)/project/projects/page.tsx",
  "src/app/(portals)/project/rooms/page.tsx",
  "src/app/(portals)/project/conversation/page.tsx",
  "src/app/(portals)/project/documents/page.tsx",
  "src/app/(portals)/project/delivery-notes/page.tsx",
  "src/apps/project/project-app-shell.tsx",
  "src/apps/project/project-home.tsx",
  "src/app/(portals)/system/layout.tsx",
  "src/app/(portals)/system/page.tsx",
  "src/app/(portals)/system/documents/page.tsx",
  "src/apps/system/system-app-shell.tsx",
  "src/apps/system/system-home.tsx",
];

const DELETE_IF_ADDED_AFTER_BASELINE = [
  "src/app/(portals)/system/accounts/page.tsx",
];

function show(path) {
  return execSync(`git show ${BASE}:${path}`, {
    cwd: ROOT,
    maxBuffer: 10e6,
  });
}

const restored = [];
for (const rel of RESTORE) {
  const buf = show(rel);
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, buf);
  const he = [...buf.toString("utf8").matchAll(/[\u0590-\u05FF]+/g)]
    .slice(0, 3)
    .map((m) => m[0])
    .join("|");
  console.log("RESTORED", rel, he || "(no he)");
  restored.push(rel);
}

const deleted = [];
for (const rel of DELETE_IF_ADDED_AFTER_BASELINE) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) continue;
  try {
    execSync(`git cat-file -e ${BASE}:${rel}`, { cwd: ROOT, stdio: "ignore" });
  } catch {
    unlinkSync(abs);
    console.log("DELETED (post-baseline UI)", rel);
    deleted.push(rel);
  }
}

// Restore only system + project blocks inside portals config
const baseConfig = show("src/lib/portals/config.ts").toString("utf8");
const curPath = join(ROOT, "src/lib/portals/config.ts");
let cur = readFileSync(curPath, "utf8");

function extractBlock(src, key) {
  const needle = `  ${key}: {`;
  const i = src.indexOf(needle);
  if (i < 0) throw new Error(`block ${key} not found`);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) {
        // include trailing comma/newline if present
        let end = j + 1;
        if (src[end] === ",") end++;
        return { start: i, end, text: src.slice(i, end) };
      }
    }
  }
  throw new Error(`unclosed block ${key}`);
}

for (const key of ["system", "project"]) {
  const fromBase = extractBlock(baseConfig, key);
  const fromCur = extractBlock(cur, key);
  cur = cur.slice(0, fromCur.start) + fromBase.text + cur.slice(fromCur.end);
  console.log("CONFIG block restored:", key);
}
writeFileSync(curPath, cur, "utf8");
restored.push("src/lib/portals/config.ts (system+project blocks only)");

console.log(
  JSON.stringify({ restored, deleted, baseline: BASE }, null, 2)
);
