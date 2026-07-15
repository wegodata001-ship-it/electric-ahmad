import { WmDetailPage } from "@/features/work-management/components/wm-detail-page";

type Props = { params: Promise<{ id: string }> };

export default async function FieldJournalDetailPage({ params }: Props) {
  const { id } = await params;
  return <WmDetailPage orderId={id} />;
}
