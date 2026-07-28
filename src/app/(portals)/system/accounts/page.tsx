"use client";

import { Suspense } from "react";
import { InvoicesWorkspacePage } from "@/features/partial-invoices/components/invoices-workspace-page";

/**
 * System Admin: עץ פרויקט / חשבונות — מסך עבודה ראשי.
 * רשימת פרויקטים בצד ימין + עץ מודולים + תוכן דינמי במרכז.
 */
export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">טוען…</p>}>
      <InvoicesWorkspacePage />
    </Suspense>
  );
}
