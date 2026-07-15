import { Suspense } from "react";
import { ForemanDetailPage } from "@/features/foremen/components/foreman-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">טוען...</p>}>
      <ForemanDetailPage foremanId={id} />
    </Suspense>
  );
}
