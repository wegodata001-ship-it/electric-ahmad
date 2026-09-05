"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

/** Live pending-approvals count for manager shells / homes */
export function usePendingApprovalsCount(enabled = true) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    apiClient
      .get<{ items: unknown[] }>("/api/approvals/pending")
      .then((d) => {
        if (!cancelled) setCount(d.items?.length || 0);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return count;
}
