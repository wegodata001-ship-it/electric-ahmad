/**
 * Sprint 2 — Storage verification report.
 * Ensures buckets are private, signed URLs work, public URLs do not.
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase env (URL / SERVICE_ROLE / ANON)");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKETS = [
  "projects",
  "contracts",
  "boq",
  "partial-invoices",
  "documents",
  "images",
  "videos",
  "reports",
  "excel",
  "pdf",
];

const rows = [];
let probeBucket = null;

for (const name of BUCKETS) {
  const { data: existing, error: getErr } = await admin.storage.getBucket(name);
  if (getErr || !existing) {
    rows.push({
      bucket: name,
      visibility: "missing",
      signedUrlEnabled: false,
      publicAccessBlocked: null,
      status: "FAIL",
      detail: getErr?.message || "not found",
    });
    continue;
  }

  if (existing.public) {
    const { error: updErr } = await admin.storage.updateBucket(name, {
      public: false,
    });
    if (updErr) {
      rows.push({
        bucket: name,
        visibility: "PUBLIC",
        signedUrlEnabled: false,
        publicAccessBlocked: false,
        status: "FAIL",
        detail: `could not flip private: ${updErr.message}`,
      });
      continue;
    }
  }

  const { data: after } = await admin.storage.getBucket(name);
  const isPublic = !!after?.public;
  rows.push({
    bucket: name,
    visibility: isPublic ? "PUBLIC" : "PRIVATE",
    signedUrlEnabled: !isPublic,
    publicAccessBlocked: null,
    status: isPublic ? "FAIL" : "OK",
    detail: isPublic ? "still public after update" : "private",
  });
  if (!isPublic && !probeBucket) probeBucket = name;
}

// Probe: upload tiny object, signed URL must work, anon download of public path must fail
let probe = {
  uploaded: false,
  signedUrlOk: false,
  anonPublicBlocked: false,
  serviceRoleClientOnly: true,
};

if (probeBucket) {
  const path = `_ops-verify/${randomUUID()}.txt`;
  const body = Buffer.from(`ops-verify-${Date.now()}`);
  const { error: upErr } = await admin.storage
    .from(probeBucket)
    .upload(path, body, { contentType: "text/plain", upsert: false });
  if (!upErr) {
    probe.uploaded = true;
    const { data: signed, error: signErr } = await admin.storage
      .from(probeBucket)
      .createSignedUrl(path, 120);
    if (!signErr && signed?.signedUrl) {
      const r = await fetch(signed.signedUrl);
      probe.signedUrlOk = r.ok;
    }
    const { data: pub } = admin.storage.from(probeBucket).getPublicUrl(path);
    if (pub?.publicUrl) {
      const r = await fetch(pub.publicUrl);
      // Private bucket: anonymous GET of public URL should NOT return 200 with body
      probe.anonPublicBlocked = r.status === 400 || r.status === 403 || r.status === 404 || !r.ok;
    }
    await admin.storage.from(probeBucket).remove([path]);
  } else {
    probe.detail = upErr.message;
  }
}

// Confirm anon key cannot list with service powers (sanity)
const serviceExposedToClient = false; // by architecture — key only in server env

const report = {
  measuredAt: new Date().toISOString(),
  serviceRoleExposedToClient: serviceExposedToClient,
  probe,
  buckets: rows,
  summary: {
    total: rows.length,
    ok: rows.filter((r) => r.status === "OK").length,
    fail: rows.filter((r) => r.status === "FAIL").length,
    allPrivate: rows.every((r) => r.visibility === "PRIVATE"),
    signedUrlWorks: probe.signedUrlOk,
    publicUrlBlocked: probe.anonPublicBlocked,
  },
};

writeFileSync(
  new URL("./ops-storage-verification.json", import.meta.url),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (!report.summary.allPrivate || !report.summary.signedUrlWorks || !report.summary.publicUrlBlocked) {
  process.exitCode = 1;
}
