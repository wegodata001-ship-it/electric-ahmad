import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Legacy links: project click goes to invoices workspace */
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  redirect(`/invoices?projectId=${id}`);
}
