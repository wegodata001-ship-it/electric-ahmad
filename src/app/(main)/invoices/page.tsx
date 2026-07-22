import { Suspense } from "react";
import { InvoicesWorkspacePage } from "@/features/partial-invoices/components/invoices-workspace-page";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">טוען…</p>}>
      <InvoicesWorkspacePage />
    </Suspense>
  );
}
