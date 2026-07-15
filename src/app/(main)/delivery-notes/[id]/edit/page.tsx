import { EditDeliveryNotePage } from "@/features/delivery-notes/components/edit-delivery-note-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditDeliveryNotePage noteId={id} />;
}
