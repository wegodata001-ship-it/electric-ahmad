import { ReportDetailPage } from "@/features/reports/components/report-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportDetailPage reportId={id} />;
}
