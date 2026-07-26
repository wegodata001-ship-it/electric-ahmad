import { redirect } from "next/navigation";

/** Legacy path — full review lives under /approvals/review/... */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/operations/approvals/review/measurement_sheet/${id}`);
}
