import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  redirect(`/field/work-diaries/new?reviseId=${id}`);
}
