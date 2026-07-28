import { Suspense } from "react";
import { InvoicesWorkspacePage } from "@/features/partial-invoices/components/invoices-workspace-page";

/**
 * חשבונות / עץ פרויקט — מסך קבוע:
 * רשימת פרויקטים בצד ימין + עץ מודולים במרכז.
 * לחיצה על פרויקט מחליפה את העץ — בלי Route חדש.
 */
export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">טוען…</p>}>
      <InvoicesWorkspacePage />
    </Suspense>
  );
}
