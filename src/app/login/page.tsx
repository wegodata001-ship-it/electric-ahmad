import { Suspense } from "react";
import { OfficeLoginPage } from "@/features/auth/components/office-login-page";

export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="p-10 text-center text-gray-400" dir="rtl">
          טוען התחברות...
        </p>
      }
    >
      <OfficeLoginPage />
    </Suspense>
  );
}
