/**
 * Read-only DB timing for hot Prisma queries. No schema/data changes.
 */
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const out = [];

async function time(name, fn) {
  const t0 = performance.now();
  try {
    const r = await fn();
    const ms = Math.round(performance.now() - t0);
    const meta =
      typeof r === "number"
        ? { count: r }
        : Array.isArray(r)
          ? { count: r.length }
          : r && typeof r === "object"
            ? { keys: Object.keys(r).length }
            : {};
    out.push({ name, ms, ok: true, ...meta });
    console.log(`OK  ${String(ms).padStart(6)}ms  ${name}`, meta);
    return r;
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    out.push({ name, ms, ok: false, error: e.message });
    console.log(`ERR ${String(ms).padStart(6)}ms  ${name} ${e.message}`);
  }
}

async function main() {
  const project = await prisma.project.findFirst({ orderBy: { updatedAt: "desc" } });
  const sheet = await prisma.measurementSheet.findFirst({
    where: project ? { projectId: project.id } : undefined,
    orderBy: { updatedAt: "desc" },
  });
  console.log({ projectId: project?.id, sheetId: sheet?.id });

  await time("count projects", () => prisma.project.count());
  await time("count measurementCells (all)", () =>
    prisma.measurementCell.count()
  );
  await time("count documents", () => prisma.document.count());
  await time("count workflowApprovals pending", () =>
    prisma.workflowApproval.count({ where: { status: "pending" } })
  );

  if (project) {
    await time("project findUnique light", () =>
      prisma.project.findUnique({
        where: { id: project.id },
        select: { id: true, name: true, contractor: true, location: true },
      })
    );
    await time("boq items by project", () =>
      prisma.boqItem.findMany({
        where: { projectId: project.id, deletedAt: null },
      })
    );
    await time("documents by project", () =>
      prisma.document.findMany({
        where: { projectId: project.id },
        orderBy: { updatedAt: "desc" },
      })
    );
    await time("hub fan-out parallel (5 lists take 300)", async () => {
      await Promise.all([
        prisma.workDiary.findMany({
          where: { projectId: project.id, deletedAt: null },
          take: 300,
          include: {
            project: { select: { id: true, name: true } },
            foreman: { select: { firstName: true, lastName: true } },
            workflowDocument: { select: { id: true, status: true, version: true } },
          },
        }),
        prisma.opsDeliveryNote.findMany({
          where: { projectId: project.id, deletedAt: null },
          take: 300,
          include: {
            project: { select: { id: true, name: true } },
            foreman: { select: { firstName: true, lastName: true } },
          },
        }),
        prisma.measurementSheet.findMany({
          where: { projectId: project.id },
          take: 300,
          include: {
            project: { select: { id: true, name: true } },
            createdBy: { select: { name: true } },
          },
        }),
        prisma.partialInvoice.findMany({
          where: { projectId: project.id },
          take: 300,
          include: { project: { select: { id: true, name: true } } },
        }),
        prisma.document.findMany({
          where: { projectId: project.id },
          take: 300,
          include: {
            project: { select: { id: true, name: true } },
            uploadedBy: { select: { name: true } },
          },
        }),
      ]);
      return 5;
    });
  }

  if (sheet) {
    await time("sheet cells count", () =>
      prisma.measurementCell.count({ where: { sheetId: sheet.id } })
    );
    await time("sheet rows count", () =>
      prisma.measurementSheetRow.count({ where: { sheetId: sheet.id } })
    );
    await time("getById-like heavy include", () =>
      prisma.measurementSheet.findUnique({
        where: { id: sheet.id },
        include: {
          rows: { include: { projectRoom: true } },
          cells: {
            include: {
              boqItem: {
                select: {
                  id: true,
                  code: true,
                  description: true,
                  unit: true,
                  contractQuantity: true,
                  completedQuantity: true,
                  unitPrice: true,
                  invoicedQuantity: true,
                  remainingQuantity: true,
                  deletedAt: true,
                },
              },
            },
          },
          project: true,
          createdBy: { select: { id: true, name: true } },
          approvals: {
            include: { approver: { select: { id: true, name: true, role: true } } },
          },
          reviewNotes: {
            include: { author: { select: { id: true, name: true } } },
          },
          events: {
            take: 40,
            include: { actor: { select: { id: true, name: true } } },
          },
          versions: { take: 20, orderBy: { version: "desc" } },
        },
      })
    );
    await time("cells only (ids+qty)", () =>
      prisma.measurementCell.findMany({
        where: { sheetId: sheet.id },
        select: { id: true, rowId: true, boqItemId: true, quantity: true },
      })
    );
    await time("single cell update", async () => {
      const c = await prisma.measurementCell.findFirst({
        where: { sheetId: sheet.id },
      });
      if (!c) return 0;
      await prisma.measurementCell.update({
        where: { id: c.id },
        data: { quantity: c.quantity },
      });
      return 1;
    });
    await time("serial 10 cell updates in TX", async () => {
      const cells = await prisma.measurementCell.findMany({
        where: { sheetId: sheet.id },
        take: 10,
      });
      await prisma.$transaction(async (tx) => {
        for (const c of cells) {
          await tx.measurementCell.update({
            where: { id: c.id },
            data: { quantity: c.quantity },
          });
        }
      });
      return cells.length;
    });
  }

  await time("pending approvals listPending shape", () =>
    prisma.workflowApproval.findMany({
      where: { status: "pending" },
      include: {
        document: {
          include: {
            project: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
          },
        },
        approver: { select: { id: true, name: true } },
      },
    })
  );

  await time("all projects for KPI-style sum", () =>
    prisma.project.findMany({
      select: {
        id: true,
        contractValue: true,
        completedValue: true,
        status: true,
      },
    })
  );

  const fs = await import("node:fs");
  fs.writeFileSync(
    new URL("./perf-audit-db-results.json", import.meta.url),
    JSON.stringify(
      { measuredAt: new Date().toISOString(), results: out },
      null,
      2
    )
  );
  console.log("\nWrote scripts/perf-audit-db-results.json");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
