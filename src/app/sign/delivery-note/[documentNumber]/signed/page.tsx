import { Suspense } from "react";
import { ClientSignedDocumentView } from "@/features/share/components/client-signed-document-view";

export default async function Page({
  params,
}: {
  params: Promise<{ documentNumber: string }>;
}) {
  const { documentNumber } = await params;
  const apiBase = `/api/sign/delivery-note/${encodeURIComponent(documentNumber)}`;
  return (
    <Suspense fallback={<p className="p-10 text-center">טוען…</p>}>
      <ClientSignedDocumentView apiBase={apiBase} />
    </Suspense>
  );
}
