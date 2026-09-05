import { DriverDnForm } from "@/apps/driver/driver-dn-form";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DriverDnForm editId={id} />;
}
