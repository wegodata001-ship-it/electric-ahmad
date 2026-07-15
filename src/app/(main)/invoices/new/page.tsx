import { Suspense } from "react";
import { SimpleInvoicePage } from "@/features/partial-invoices/components/simple-invoice-page";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">טוען...</p>}>
      <SimpleInvoicePage />
    </Suspense>
  );
}
