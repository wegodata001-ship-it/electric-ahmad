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
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [portalRole, setPortalRole] = useState<string | null>(null);
  const [canViewFinance, setCanViewFinance] = useState(false);
  const [ready, setReady] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const meUrl =
      portalId === "field"
        ? "/api/field/auth/me"
        : portalId === "subcontractor"
          ? "/api/subcontractor/auth/me"
          : "/api/auth/me";
    fetchClientMe(meUrl)
      .then((json) => {
        if (!json.success) {
          router.replace("/login");
          return;
        }
        setUserName(json.data?.name ?? null);
        setUsername(
          typeof json.data?.username === "string" ? json.data.username : null
        );
        const nextRole = json.data?.role as string | undefined;
        setRole(nextRole ?? null);
        setCompanyName(
          typeof json.data?.companyName === "string" ? json.data.companyName : null
        );
        setPortalRole(
          typeof json.data?.portalRole === "string" ? json.data.portalRole : null
        );
        setCanViewFinance(json.data?.canViewFinance === true);
        if (!canAccessPortal(nextRole, portalId)) {
          router.replace(portalHomeOrLogin(nextRole));
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
      } else if (portalId === "subcontractor") {
        await fetch("/api/subcontractor/auth/logout", { method: "POST" });
      } else {
        await fetch("/api/auth/logout", { method: "POST" });
      }
      clearClientMeCache();
      window.location.assign("/login");
    } catch {
      setLoggingOut(false);
      router.replace("/login");
    }
  }

  return {
    userName,
    username,
    role,
    companyName,
    portalRole,
    canViewFinance,
    ready,
    loggingOut,
    logout,
  };
}
