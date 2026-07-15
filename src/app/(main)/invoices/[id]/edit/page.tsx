import { EditPartialInvoicePage } from "@/features/partial-invoices/components/edit-partial-invoice-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditPartialInvoicePage invoiceId={id} />;
}
