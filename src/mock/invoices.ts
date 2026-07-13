import type { PartialInvoice, InvoiceStatus } from "@/types";
import { boqItems } from "./boq";
import { projects } from "./projects";
import { generateId, pick, randomInt, seededRandom } from "./generators";

const STATUSES: InvoiceStatus[] = ["draft", "submitted", "approved", "paid", "rejected"];

export function generateInvoices(count = 25): PartialInvoice[] {
  const rand = seededRandom(500);
  const invoices: PartialInvoice[] = [];

  for (let i = 0; i < count; i++) {
    const project = pick(projects, rand);
    const projectItems = boqItems.filter((b) => b.projectId === project.id && b.completedQuantity > 0);
    const itemCount = Math.min(randomInt(2, 6, rand), projectItems.length);
    const selectedItems = projectItems.slice(0, itemCount);

    const includedItems = selectedItems.map((item) => ({
      boqItemId: item.id,
      code: item.code,
      description: item.description,
      quantity: randomInt(1, item.completedQuantity, rand),
      unitPrice: item.unitPrice,
      total: 0,
    }));

    includedItems.forEach((item) => {
      item.total = item.quantity * item.unitPrice;
    });

    const amount = includedItems.reduce((sum, item) => sum + item.total, 0);
    const daysAgo = randomInt(0, 120, rand);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    invoices.push({
      id: generateId("inv", i + 1),
      projectId: project.id,
      projectName: project.name,
      invoiceNumber: `INV-2025-${String(i + 1).padStart(4, "0")}`,
      amount,
      status: pick(STATUSES, rand),
      date: date.toISOString(),
      dueDate: new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      includedItems,
      createdAt: date.toISOString(),
    });
  }

  return invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export const partialInvoices = generateInvoices(25);
