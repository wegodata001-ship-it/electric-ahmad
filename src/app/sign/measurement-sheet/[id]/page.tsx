import { Suspense } from "react";
import { MeasurementClientSignPage } from "@/features/partial-invoices/components/measurement-client-sign-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-gray-500">
          טוען…
        </div>
      }
    >
      <MeasurementClientSignPage sheetId={id} />
    </Suspense>
  );
}
