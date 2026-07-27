import { ProjectTreeHubPage } from "@/features/projects/components/project-tree-hub-page";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** לחיצה על פרויקט → בית הפרויקט עם מסכי פירוט */
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ProjectTreeHubPage projectId={id} />;
}
