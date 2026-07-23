import { OpsMeasurementReview } from "@/apps/operations/ops-measurement-review";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OpsMeasurementReview sheetId={id} />;
}
