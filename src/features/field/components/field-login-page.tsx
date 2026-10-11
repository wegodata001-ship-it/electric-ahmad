"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { unifiedLoginHref } from "@/lib/auth/login-redirect";

/** @deprecated Field login is unified at /login. Kept as a client fallback. */
export function FieldLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    router.replace(unifiedLoginHref(searchParams.get("next")));
  }, [router, searchParams]);

  return (
    <p className="p-10 text-center text-[#5B6470]" dir="rtl">
      מעבירים להתחברות…
    </p>
  );
}
