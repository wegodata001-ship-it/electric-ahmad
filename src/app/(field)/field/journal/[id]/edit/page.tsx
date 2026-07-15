import { WmBuildPage } from "@/features/work-management/components/wm-build-page";

type Props = { params: Promise<{ id: string }> };

export default async function FieldJournalEditPage({ params }: Props) {
  const { id } = await params;
  return <WmBuildPage orderId={id} />;
}
