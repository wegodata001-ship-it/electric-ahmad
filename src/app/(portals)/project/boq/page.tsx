import { Suspense } from "react";
import { BoqPage } from "@/features/boq/components/boq-page";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">טוען...</p>}>
      <BoqPage />
    </Suspense>
  );
}
