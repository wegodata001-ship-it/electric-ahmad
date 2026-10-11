import { Suspense } from "react";
import { NewProjectWizard } from "@/features/projects/components/new-project-wizard";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">טוען…</div>}>
      <NewProjectWizard />
    </Suspense>
  );
}
