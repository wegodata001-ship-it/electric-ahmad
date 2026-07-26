"use client";

import { Suspense } from "react";
import { ClientDocumentPortal } from "@/features/share/components/client-document-portal";

export function ClientSignPage({
  kind,
  documentNumber,
}: {
  kind: "work-diary" | "delivery-note";
  documentNumber: string;
}) {
  const apiBase =
    kind === "work-diary"
      ? `/api/sign/work-diary/${documentNumber}`
      : `/api/sign/delivery-note/${documentNumber}`;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-slate-500">
          טוען…
        </div>
      }
    >
      <ClientDocumentPortal apiBase={apiBase} />
    </Suspense>
  );
}
