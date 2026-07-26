"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PortalId } from "@/lib/portals/config";
import { canAccessPortal, portalHomeOrLogin } from "@/lib/portals/access";
import {
  clearClientMeCache,
  fetchClientMe,
} from "@/lib/auth/client-me";

export function usePortalSession(portalId: PortalId) {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const meUrl = portalId === "field" ? "/api/field/auth/me" : "/api/auth/me";
    fetchClientMe(meUrl)
      .then((json) => {
        if (!json.success) {
          router.replace("/login");
          return;
        }
        setUserName(json.data?.name ?? null);
        const role = json.data?.role as string | undefined;
        if (!canAccessPortal(role, portalId)) {
          router.replace(portalHomeOrLogin(role));
          return;
        }
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [portalId, router]);

  async function logout() {
    setLoggingOut(true);
    try {
      if (portalId === "field") {
        await fetch("/api/field/auth/logout", { method: "POST" });
      } else {
        await fetch("/api/auth/logout", { method: "POST" });
      }
      clearClientMeCache();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return { userName, ready, loggingOut, logout };
}
