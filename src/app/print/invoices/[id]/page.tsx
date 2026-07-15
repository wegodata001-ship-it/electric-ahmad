import { Suspense } from "react";
import { PartialInvoicePrintPage } from "@/features/partial-invoices/components/partial-invoice-print-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="p-8 text-sm text-gray-400">טוען...</p>}>
      <PartialInvoicePrintPage invoiceId={id} />
    </Suspense>
  );
}
