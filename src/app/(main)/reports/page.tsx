import { Suspense } from "react";
import { ReportsPage } from "@/features/reports/components/reports-page";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">טוען דיווחים...</p>}>
      <ReportsPage />
    </Suspense>
  );
}
