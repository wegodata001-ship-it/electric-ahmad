import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Legacy links → Project Portal hub (פירוט מסכים) */
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  redirect(`/project/projects/${id}`);
}
