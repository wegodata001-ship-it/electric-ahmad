import { Suspense } from "react";
import { ExecutionReportsPage } from "@/features/execution-reports/components/execution-reports-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="py-12 text-center text-sm text-stone-400">טוען דוחות…</p>
      }
    >
      <ExecutionReportsPage />
    </Suspense>
  );
}
