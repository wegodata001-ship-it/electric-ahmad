import type { PartialInvoice, InvoiceStatus } from "@/types";
import { boqItems } from "./boq";
import { projects } from "./projects";
import { generateId, pick, randomInt, seededRandom } from "./generators";
import { computeInvoiceLine, formatBillingMonth } from "@/utils/invoice-calc";

const STATUSES: InvoiceStatus[] = [
  "draft",
  "pending_foreman_approval",
  "approved_by_foreman",
  "rejected_by_foreman",
  "sent_to_client",
  "paid",
];

export function generateInvoices(count = 25): PartialInvoice[] {
  const rand = seededRandom(500);
  const invoices: PartialInvoice[] = [];

  for (let i = 0; i < count; i++) {
    const project = pick(projects, rand);
    const projectItems = boqItems.filter(
      (b) => b.projectId === project.id && b.completedQuantity > 0
    );
    const itemCount = Math.min(randomInt(2, 6, rand), projectItems.length);
    const selectedItems = projectItems.slice(0, itemCount);
    const sequenceNumber = i + 1;

    const includedItems = selectedItems.map((item) => {
      const quantity = randomInt(1, item.completedQuantity, rand);
      const previousQuantity = 0;
      const calc = computeInvoiceLine({
        contractQuantity: item.contractQuantity,
        previousQuantity,
        currentQuantity: quantity,
        unitPrice: item.unitPrice,
      });
      return {
        boqItemId: item.id,
        code: item.code,
        description: item.description,
        unit: item.unit,
        contractQuantity: item.contractQuantity,
        previousQuantity,
        quantity,
        cumulativeQuantity: calc.cumulativeQuantity,
        quantityPercent: calc.quantityPercent,
        unitPrice: item.unitPrice,
        previousAmount: previousQuantity * item.unitPrice,
        total: calc.currentAmount,
        cumulativeAmount: calc.cumulativeAmount,
        financialPercent: calc.financialPercent,
      };
    });

    const amount = includedItems.reduce((sum, item) => sum + item.total, 0);
    const daysAgo = randomInt(0, 120, rand);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    invoices.push({
      id: generateId("inv", i + 1),
      projectId: project.id,
      projectName: project.name,
      invoiceNumber: `${project.contractNumber}-חשבון-${sequenceNumber}`,
      sequenceNumber,
      billingMonth: formatBillingMonth(date),
      billTo: project.name,
      contractor: project.contractor,
      amount,
      previousTotal: 0,
      cumulativeTotal: amount,
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
