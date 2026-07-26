import { DocumentsHubV2Page } from "@/features/documents/components/documents-hub-v2-page";

export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentsHubV2Page projectId={id} />;
}
