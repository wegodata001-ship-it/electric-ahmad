import { InvoiceSummaryPage } from "@/features/partial-invoices/components/invoice-summary-page";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <InvoiceSummaryPage projectId={projectId} />;
}
