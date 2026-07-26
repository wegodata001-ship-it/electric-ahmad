import { Suspense } from "react";
import { FieldDiaryQuick } from "@/apps/field/field-diary-quick";

export default function Page() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-white/40">טוען…</p>}>
      <FieldDiaryQuick />
    </Suspense>
  );
}
