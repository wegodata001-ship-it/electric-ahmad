import { WorkDiaryBuildPage } from "@/features/work-diaries/components/work-diary-build-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkDiaryBuildPage diaryId={id} />;
}
