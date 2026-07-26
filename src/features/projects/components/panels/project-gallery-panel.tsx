"use client";

import { DocumentsHubV2Page } from "@/features/documents/components/documents-hub-v2-page";

/** תמונות/גלריה — חלק ממרכז המסמכים */
export function ProjectGalleryPanel({ projectId }: { projectId: string }) {
  return <DocumentsHubV2Page projectId={projectId} embedded />;
}
