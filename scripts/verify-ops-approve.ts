async function main() {
  const login = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "opsmgr", password: "WegoAudit123!" }),
  });
  const cookie = (login.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const pending = await fetch("http://localhost:3000/api/approvals/pending", {
    headers: { Cookie: cookie },
  }).then((r) => r.json());

  const demo = (pending.data?.items ?? []).find(
    (i: { documentNumber: string }) => i.documentNumber === "WD-DEMO-0001"
  );
  console.log(
    "pending demo",
    demo
      ? { id: demo.documentId, num: demo.documentNumber }
      : { missing: true, items: pending.data?.items?.length }
  );
  if (!demo) return;

  const decideRes = await fetch("http://localhost:3000/api/approvals/pending", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      kind: "work_diary",
      documentId: demo.documentId,
      decision: "approved",
    }),
  });
  const decide = await decideRes.json();
  console.log("decide", decideRes.status, {
    success: decide.success,
    status: decide.data?.status,
    approvalComplete: decide.data?.approvalComplete,
    awaitingOtherApprovers: decide.data?.awaitingOtherApprovers,
    error: decide.error,
  });

  const pending2 = await fetch("http://localhost:3000/api/approvals/pending", {
    headers: { Cookie: cookie },
  }).then((r) => r.json());
  const still = (pending2.data?.items ?? []).some(
    (i: { documentNumber: string }) => i.documentNumber === "WD-DEMO-0001"
  );
  console.log("still in list after approve:", still);
}

main().catch(console.error);
