import { PartialInvoiceDetailPage } from "@/features/partial-invoices/components/partial-invoice-detail-page";

export default async function PartialInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PartialInvoiceDetailPage invoiceId={id} />;
}
