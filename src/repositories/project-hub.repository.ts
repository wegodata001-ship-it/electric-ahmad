import { prisma } from "@/lib/prisma";
import { INVOICE_STATUS_LABELS } from "@/constants";
import type { InvoiceStatus } from "@/types";

function num(v: unknown) {
  return Number(v ?? 0);
}

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

export class ProjectHubRepository {
  static async getHub(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        contractNumber: true,
        contractor: true,
        location: true,
        status: true,
        progress: true,
        financialProgress: true,
        contractValue: true,
        completedValue: true,
        invoicedValue: true,
        measurementAxisType: true,
        measurementAxisLabel: true,
        foreman: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!project) return null;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      boqItems,
      sheets,
      cellAgg,
      entryCount,
      lastEntry,
      invoices,
      documents,
      recentDocs,
      workDiaries,
      lastDiary,
      deliveryNotes,
      openDeliveries,
    ] = await Promise.all([
      prisma.boqItem.findMany({
        where: { projectId, deletedAt: null },
        select: {
          contractQuantity: true,
          completedQuantity: true,
          progress: true,
        },
      }),
      prisma.measurementSheet.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          status: true,
          _count: { select: { rows: true, cells: true } },
        },
        orderBy: { sequenceNumber: "asc" },
      }),
      prisma.measurementCell.aggregate({
        where: { sheet: { projectId } },
        _sum: { quantity: true },
        _count: true,
      }),
      prisma.measurementEntry.count({ where: { sheet: { projectId } } }),
      prisma.measurementEntry.findFirst({
        where: { sheet: { projectId } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.partialInvoice.findMany({
        where: { projectId },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          amount: true,
          sequenceNumber: true,
        },
        orderBy: { sequenceNumber: "desc" },
      }),
      prisma.document.count({ where: { projectId } }),
      prisma.document.count({
        where: { projectId, createdAt: { gte: weekAgo } },
      }),
      prisma.workDiary.count({
        where: { projectId, deletedAt: null },
      }),
      prisma.workDiary.findFirst({
        where: { projectId, deletedAt: null },
        orderBy: { workDate: "desc" },
        select: { workDate: true },
      }),
      prisma.opsDeliveryNote.count({
        where: { projectId, deletedAt: null },
      }),
      prisma.opsDeliveryNote.count({
        where: {
          projectId,
          deletedAt: null,
          status: { in: ["draft", "pending_approval", "revision"] },
        },
      }),
    ]);

    const boqCount = boqItems.length;
    const completedQty = boqItems.reduce(
      (s, i) => s + num(i.completedQuantity),
      0
    );
    const avgProgress =
      boqCount > 0
        ? Math.round(
            (boqItems.reduce((s, i) => s + (i.progress || 0), 0) / boqCount) * 10
          ) / 10
        : project.progress;

    const unitRowCount = await prisma.projectRoom.count({
      where: { projectId, deletedAt: null, isHidden: false },
    });

    const invoiceGroups = {
      draft: invoices.filter((i) => i.status === "draft").length,
      pending: invoices.filter((i) => i.status === "pending_foreman_approval")
        .length,
      approved: invoices.filter(
        (i) =>
          i.status === "approved_by_foreman" || i.status === "approved"
      ).length,
      sent: invoices.filter(
        (i) => i.status === "sent_to_client" || i.status === "signed"
      ).length,
      paid: invoices.filter((i) => i.status === "paid").length,
    };

    const invoicedSum = invoices
      .filter((i) =>
        ["approved_by_foreman", "approved", "sent_to_client", "signed", "paid"].includes(
          i.status
        )
      )
      .reduce((s, i) => s + num(i.amount), 0);

    const axisLabel =
      project.measurementAxisLabel ||
      (
        {
          room: "חדרים",
          floor: "קומות",
          building: "בניינים",
          area: "אזורים",
          custom: "יחידות",
        } as const
      )[project.measurementAxisType] ||
      "יחידות";

    const foremanName = project.foreman
      ? `${project.foreman.firstName} ${project.foreman.lastName}`
      : "";

    return {
      project: {
        id: project.id,
        name: project.name,
        contractNumber: project.contractNumber,
        contractor: project.contractor,
        location: project.location,
        status: project.status,
        progress: avgProgress,
        financialProgress: project.financialProgress,
        contractValue: num(project.contractValue),
        completedValue: num(project.completedValue),
        invoicedValue: num(project.invoicedValue),
        measurementAxisType: project.measurementAxisType,
        axisLabel,
        foremanName,
        foremanId: project.foreman?.id ?? null,
      },
      cards: {
        boq: {
          itemCount: boqCount,
          completedQuantity: completedQty,
          progressPercent: avgProgress,
        },
        performance: {
          unitCount: unitRowCount,
          sheetCount: sheets.length,
          reportCount: entryCount || cellAgg._count || 0,
          lastReportAt: iso(lastEntry?.createdAt),
        },
        invoices: {
          total: invoices.length,
          ...invoiceGroups,
          invoicedAmount: invoicedSum || num(project.invoicedValue),
          items: invoices.slice(0, 8).map((i) => ({
            id: i.id,
            invoiceNumber: i.invoiceNumber,
            status: i.status,
            statusLabel:
              INVOICE_STATUS_LABELS[i.status as InvoiceStatus] ?? i.status,
            amount: num(i.amount),
          })),
        },
        documents: {
          total: documents,
          recent: recentDocs,
        },
        workDiaries: {
          total: workDiaries,
          lastAt: iso(lastDiary?.workDate),
        },
        deliveries: {
          total: deliveryNotes,
          open: openDeliveries,
        },
      },
    };
  }
}
