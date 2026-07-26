import { Suspense } from "react";
import { FieldDnQuick } from "@/apps/field/field-dn-quick";

export default function Page() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-white/40">טוען…</p>}>
      <FieldDnQuick />
    </Suspense>
  );
}
