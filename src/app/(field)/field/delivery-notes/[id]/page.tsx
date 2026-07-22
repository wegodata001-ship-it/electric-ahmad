import { FieldDeliveryNoteDetailPage } from "@/features/work-diaries/components/field-delivery-notes-pages";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FieldDeliveryNoteDetailPage id={id} />;
}
