import { PrismaClient } from "@prisma/client";
import { MeasurementSheetsRepository } from "../src/repositories/measurement-sheets.repository";

const p = new PrismaClient();

async function main() {
  const user =
    (await p.user.findFirst({ where: { role: "PROJECT_MANAGER" } })) ||
    (await p.user.findFirst({ where: { role: "SYSTEM_MANAGER" } })) ||
    (await p.user.findFirst());
  if (!user) throw new Error("No user");

  const sheets = await p.measurementSheet.findMany({
    where: {
      status: { in: ["draft", "in_progress", "revision"] },
      cells: { none: {} },
      rows: { some: {} },
    },
    select: { id: true, title: true, projectId: true },
  });

  console.log(`Found ${sheets.length} empty grids`);
  for (const s of sheets) {
    // ensureBoqGrid → getById: null when the sheet is missing after work
    // (deleted concurrently) or fetchSheetById returns non-ok. Valid skip case.
    const out = await MeasurementSheetsRepository.ensureBoqGrid(s.id, user.id, {
      seedIfEmpty: true,
    });
    if (!out) {
      console.warn(`Measurement grid generation failed for sheet ${s.id}`);
      continue;
    }
    console.log({
      title: s.title,
      cells: out.cells.length,
      columns: new Set(out.cells.map((c) => c.boqItemId)).size,
    });
  }
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
