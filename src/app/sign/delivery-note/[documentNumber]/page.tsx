import { Suspense } from "react";
import { ClientSignPage } from "@/features/work-diaries/components/client-sign-page";

export default async function Page({
  params,
}: {
  params: Promise<{ documentNumber: string }>;
}) {
  const { documentNumber } = await params;
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">טוען…</div>}>
      <ClientSignPage kind="delivery-note" documentNumber={documentNumber} />
    </Suspense>
  );
}
