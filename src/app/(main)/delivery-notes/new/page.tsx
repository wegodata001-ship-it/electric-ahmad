import { Suspense } from "react";
import { CreateDeliveryNotePage } from "@/features/delivery-notes/components/create-delivery-note-page";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">טוען...</p>}>
      <CreateDeliveryNotePage />
    </Suspense>
  );
}
