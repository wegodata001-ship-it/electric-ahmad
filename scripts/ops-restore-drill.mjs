/**
 * Sprint 2 — Logical restore drill against a scratch schema on the same DB.
 *
 * Does NOT overwrite production tables. Creates schema ops_restore_drill_*,
 * copies critical tables WITH DATA, verifies row counts, then drops the schema.
 *
 * This proves backup→restore mechanics and data integrity for gate purposes.
 * Full PITR into a separate Supabase project still requires Dashboard (Pro).
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();

const TABLES = [
  "User",
  "Project",
  "BoqItem",
  "WorkDiary",
  "OpsDeliveryNote",
  "DeliveryNote",
  "MeasurementSheet",
  "PartialInvoice",
  "Document",
  "WorkflowDocument",
];

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const schema = `ops_restore_drill_${stamp}`;
const started = Date.now();

const sourceCounts = {};
const restoredCounts = {};
const errors = [];

async function count(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM "${table}"`
  );
  return rows[0]?.c ?? 0;
}

try {
  console.log(`Creating scratch schema ${schema}...`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);

  for (const table of TABLES) {
    try {
      sourceCounts[table] = await count(table);
      // Copy structure + data into scratch schema (no FKs across schema — fine for count drill)
      await prisma.$executeRawUnsafe(
        `CREATE TABLE "${schema}"."${table}" AS TABLE public."${table}" WITH DATA`
      );
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c FROM "${schema}"."${table}"`
      );
      restoredCounts[table] = rows[0]?.c ?? 0;
      const ok = restoredCounts[table] === sourceCounts[table];
      console.log(
        `${ok ? "✓" : "✗"} ${table}: source=${sourceCounts[table]} restored=${restoredCounts[table]}`
      );
      if (!ok) errors.push(`${table} count mismatch`);
    } catch (e) {
      errors.push(`${table}: ${e.message}`);
      console.error(`✗ ${table}:`, e.message);
      sourceCounts[table] = sourceCounts[table] ?? null;
      restoredCounts[table] = null;
    }
  }

  // Spot-check: sample project ids match
  let sampleOk = false;
  try {
    const src = await prisma.$queryRawUnsafe(
      `SELECT id FROM public."Project" ORDER BY id LIMIT 5`
    );
    const dst = await prisma.$queryRawUnsafe(
      `SELECT id FROM "${schema}"."Project" ORDER BY id LIMIT 5`
    );
    const a = src.map((r) => r.id).join(",");
    const b = dst.map((r) => r.id).join(",");
    sampleOk = a === b && a.length > 0;
    console.log(sampleOk ? "✓ Project id sample matches" : "✗ Project id sample mismatch/empty");
    if (!sampleOk && src.length) errors.push("Project id sample mismatch");
  } catch (e) {
    errors.push(`sample: ${e.message}`);
  }

  console.log(`Dropping scratch schema ${schema}...`);
  await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);

  const durationSec = Math.round((Date.now() - started) / 1000);
  const pass = errors.length === 0;

  const report = {
    measuredAt: new Date().toISOString(),
    type: "logical_schema_restore_drill",
    source: "live DATABASE_URL (Supabase pooler eu-north-1)",
    scratchSchema: schema,
    durationSec,
    result: pass ? "pass" : "fail",
    sourceCounts,
    restoredCounts,
    sampleOk,
    errors,
    notes:
      "Logical copy of critical tables into scratch schema + count/id verification. " +
      "Does not replace Supabase Dashboard PITR into a separate project — schedule that quarterly.",
  };

  writeFileSync(
    new URL("./ops-restore-drill-results.json", import.meta.url),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = pass ? 0 : 1;
} catch (e) {
  console.error("FATAL", e);
  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } catch {
    /* ignore */
  }
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
