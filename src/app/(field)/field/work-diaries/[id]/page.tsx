import { WorkDiaryDetailPage } from "@/features/work-diaries/components/work-diary-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkDiaryDetailPage id={id} />;
}
