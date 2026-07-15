export interface InvoiceLineInput {
  contractQuantity: number;
  previousQuantity: number;
  currentQuantity: number;
  unitPrice: number;
}

export interface InvoiceLineComputed {
  cumulativeQuantity: number;
  quantityPercent: number;
  currentAmount: number;
  cumulativeAmount: number;
  financialPercent: number;
  contractValue: number;
}

export function computeInvoiceLine(input: InvoiceLineInput): InvoiceLineComputed {
  const contractQuantity = Number(input.contractQuantity) || 0;
  const previousQuantity = Number(input.previousQuantity) || 0;
  const currentQuantity = Number(input.currentQuantity) || 0;
  const unitPrice = Number(input.unitPrice) || 0;

  const cumulativeQuantity = previousQuantity + currentQuantity;
  const quantityPercent =
    contractQuantity > 0 ? (cumulativeQuantity / contractQuantity) * 100 : 0;
  const currentAmount = currentQuantity * unitPrice;
  const cumulativeAmount = cumulativeQuantity * unitPrice;
  const contractValue = contractQuantity * unitPrice;
  const financialPercent =
    contractValue > 0 ? (cumulativeAmount / contractValue) * 100 : 0;

  return {
    cumulativeQuantity,
    quantityPercent: Math.round(quantityPercent * 10) / 10,
    currentAmount,
    cumulativeAmount,
    financialPercent: Math.round(financialPercent * 10) / 10,
    contractValue,
  };
}

export function formatBillingMonth(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${year}`;
}

export function availableForInvoice(
  executedQuantity: number,
  invoicedQuantity: number
): number {
  return Math.max(0, (Number(executedQuantity) || 0) - (Number(invoicedQuantity) || 0));
}
