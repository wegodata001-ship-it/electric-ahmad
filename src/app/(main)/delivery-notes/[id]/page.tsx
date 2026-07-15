import { DeliveryNoteDetailPage } from "@/features/delivery-notes/components/delivery-note-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DeliveryNoteDetailPage noteId={id} />;
}
