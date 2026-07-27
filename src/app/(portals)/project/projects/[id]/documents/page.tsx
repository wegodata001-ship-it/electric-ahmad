import { DocumentsHubV2Page } from "@/features/documents/components/documents-hub-v2-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <DocumentsHubV2Page projectId={id} />;
}
