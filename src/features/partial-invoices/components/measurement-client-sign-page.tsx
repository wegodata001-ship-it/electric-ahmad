"use client";

import { Suspense } from "react";
import { ClientDocumentPortal } from "@/features/share/components/client-document-portal";

/** Public client page: full document portal + sign */
export function MeasurementClientSignPage({ sheetId }: { sheetId: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-slate-500">
          טוען…
        </div>
      }
    >
      <ClientDocumentPortal
        apiBase={`/api/sign/measurement-sheet/${sheetId}`}
      />
    </Suspense>
  );
}
