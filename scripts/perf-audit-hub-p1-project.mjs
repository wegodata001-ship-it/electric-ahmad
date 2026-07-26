/** Re-measure hub HTTP for a specific projectId */
import { performance } from "node:perf_hooks";

const BASE = process.argv[2] || "http://localhost:3000";
const PROJECT_ID = process.argv[3] || "cms034ch70002kz04wu99jp4h";
const PASSWORD = process.env.PERF_PASSWORD || "WegoAudit123!";

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "sysmgr", password: PASSWORD }),
  });
  const cookie = (login.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");
  for (const label of ["cold", "warm"]) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/api/projects/${PROJECT_ID}/hub`, {
      headers: { Cookie: cookie },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const j = JSON.parse(buf.toString("utf8"));
    console.log(
      JSON.stringify({
        label,
        ms: Math.round(performance.now() - t0),
        status: res.status,
        bytes: buf.length,
        name: j.data?.project?.name,
        boqItems: j.data?.cards?.boq?.itemCount,
        sheets: j.data?.cards?.performance?.sheetCount,
      })
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
