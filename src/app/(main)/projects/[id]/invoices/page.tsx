import { ProjectInvoicesPage } from "@/features/projects/components/project-invoices-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ProjectInvoicesPage projectId={id} />;
}
