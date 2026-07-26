import { Suspense } from "react";
import { ClientSignedDocumentView } from "@/features/share/components/client-signed-document-view";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="p-10 text-center">טוען…</p>}>
      <ClientSignedDocumentView
        apiBase={`/api/sign/measurement-sheet/${id}`}
      />
    </Suspense>
  );
}
