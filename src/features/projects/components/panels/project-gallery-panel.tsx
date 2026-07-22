"use client";

import { ProjectDocumentsHubPage } from "@/features/projects/components/project-documents-hub-page";

/**
 * @deprecated מודול תמונות בוטל — הכל תחת מסמכים.
 * נשאר כעטיפה לתאימות ייבואים ישנים.
 */
export function ProjectGalleryPanel({ projectId }: { projectId: string }) {
  return <ProjectDocumentsHubPage projectId={projectId} embedded />;
}
