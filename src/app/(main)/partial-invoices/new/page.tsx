import { Suspense } from "react";
import { CreatePartialInvoicePage } from "@/features/partial-invoices/components/create-partial-invoice-page";

export default function NewPartialInvoicePage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">טוען...</p>}>
      <CreatePartialInvoicePage />
    </Suspense>
  );
}
