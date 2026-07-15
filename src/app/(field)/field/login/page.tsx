import { Suspense } from "react";
import { FieldLoginPage } from "@/features/field/components/field-login-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="p-10 text-center text-gray-400">טוען התחברות...</p>
      }
    >
      <FieldLoginPage />
    </Suspense>
  );
}
