import { Suspense } from "react";
import { ConversationCenterPage } from "@/features/platform/components";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">טוען...</p>}>
      <ConversationCenterPage />
    </Suspense>
  );
}
