"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

/**
 * Badge for «תיקונים» nav — count of documents needing fix
 * that the current user can edit.
 */
export function usePendingApprovalsCount(enabled = true) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    apiClient
      .get<{ items?: unknown[]; count?: number }>("/api/approvals/revisions")
      .then((d) => {
        if (!cancelled) setCount(d.count ?? d.items?.length ?? 0);
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
