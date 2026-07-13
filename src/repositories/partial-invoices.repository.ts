import { prisma } from "@/lib/prisma";
import { mapPartialInvoice } from "@/lib/mappers";

export class PartialInvoicesRepository {
  static invoiceInclude = {
    project: { select: { name: true } },
    items: true,
  } as const;

  static async findAll() {
    const rows = await prisma.partialInvoice.findMany({
      include: this.invoiceInclude,
      orderBy: { date: "desc" },
    });
    return rows.map(mapPartialInvoice);
  }

  static async findByProject(projectId: string) {
    const rows = await prisma.partialInvoice.findMany({
      where: { projectId },
      include: this.invoiceInclude,
      orderBy: { date: "desc" },
    });
    return rows.map(mapPartialInvoice);
  }

  static async findById(id: string) {
    const row = await prisma.partialInvoice.findUnique({
      where: { id },
      include: this.invoiceInclude,
    });
    return row ? mapPartialInvoice(row) : null;
  }
}
