import { FieldWorkOrderDetail } from "@/apps/field/field-work-order-detail";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FieldWorkOrderDetail orderId={id} />;
}
