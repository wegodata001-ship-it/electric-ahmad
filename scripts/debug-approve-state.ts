import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const ops = await p.user.findFirst({ where: { username: "opsmgr" } });
  const wfId = "cmrxdsooa000ar13ot5a0z4j2";
  const all = await p.workflowApproval.findMany({ where: { documentId: wfId } });
  console.log(
    "approvals",
    all.map((a) => ({
      id: a.id,
      approverId: a.approverId,
      status: a.status,
      decidedAt: a.decidedAt,
    }))
  );
  console.log(
    "ops pending",
    await p.workflowApproval.count({
      where: { approverId: ops!.id, status: "pending" },
    })
  );
  const wf = await p.workflowDocument.findUnique({ where: { id: wfId } });
  console.log("wf status", wf?.status);

  // HTTP-level test
  const login = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "opsmgr", password: "WegoAudit123!" }),
  });
  const loginJson = await login.json();
  const cookie = login.headers.getSetCookie?.() ?? [];
  const cookieHeader = cookie.map((c) => c.split(";")[0]).join("; ");
  console.log("login", loginJson.success, loginJson.data?.role);

  const pendingRes = await fetch("http://localhost:3000/api/approvals/pending", {
    headers: { Cookie: cookieHeader },
  });
  const pendingJson = await pendingRes.json();
  console.log(
    "pending API",
    pendingJson.success,
    (pendingJson.data?.items ?? []).map((i: any) => ({
      kind: i.kind,
      documentId: i.documentId,
      documentNumber: i.documentNumber,
    }))
  );

  const target = (pendingJson.data?.items ?? []).find(
    (i: any) => i.documentNumber === "WD-000006" || i.kind === "work_diary"
  );
  if (target) {
    const decideRes = await fetch("http://localhost:3000/api/approvals/pending", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        kind: target.kind,
        documentId: target.documentId,
        decision: "approved",
      }),
    });
    const decideJson = await decideRes.json();
    console.log("decide HTTP", decideRes.status, decideJson);
  } else {
    console.log("no pending item to approve via HTTP");
  }
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
