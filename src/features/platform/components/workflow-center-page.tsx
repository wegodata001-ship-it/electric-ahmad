"use client";

import { useCallback, useEffect, useState } from "react";
import { GitBranch, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatRelative } from "@/utils/format";
import { ActionBarContainer } from "@/components/portal";

type WorkflowPendingItem = {
  approvalId: string;
  documentId: string;
  kind: string;
  documentNumber: string;
  title: string;
  status: string;
  projectId: string;
  projectName: string;
  createdByName: string;
  sentAt: string;
};

type LegacyApprovalItem = {
  kind: string;
  documentId: string;
  documentNumber: string;
  title?: string;
  projectName?: string;
  sentAt: string;
  [key: string]: unknown;
};

type PendingRow = {
  id: string;
  source: "workflow" | "legacy";
  kind: string;
  documentNumber: string;
  title: string;
  projectName: string;
  sentAt: string;
};

export function WorkflowCenterPage() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.allSettled([
      apiClient.get<{ items: WorkflowPendingItem[] }>("/api/workflow/pending"),
      apiClient.get<{ items: LegacyApprovalItem[] }>("/api/approvals/pending"),
    ])
      .then(([workflowRes, legacyRes]) => {
        const merged: PendingRow[] = [];

        if (workflowRes.status === "fulfilled") {
          for (const item of workflowRes.value.items) {
            merged.push({
              id: item.approvalId,
              source: "workflow",
              kind: item.kind,
              documentNumber: item.documentNumber,
              title: item.title,
              projectName: item.projectName,
              sentAt: item.sentAt,
            });
          }
        }

        if (legacyRes.status === "fulfilled") {
          for (const item of legacyRes.value.items) {
            merged.push({
              id: `${item.kind}-${item.documentId}`,
              source: "legacy",
              kind: item.kind,
              documentNumber: item.documentNumber,
              title: item.title ?? item.documentNumber,
              projectName: item.projectName ?? "—",
              sentAt: item.sentAt,
            });
          }
        }

        if (
          workflowRes.status === "rejected" &&
          legacyRes.status === "rejected"
        ) {
          const msg =
            workflowRes.reason instanceof Error
              ? workflowRes.reason.message
              : "שגיאה בטעינה";
          setError(msg);
        }

        merged.sort(
          (a, b) =>
            new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
        );
        setRows(merged);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">מרכז Workflow</h1>
        <p className="mt-1 text-sm text-gray-500">
          מסמכים ממתינים לאישור — Workflow + מסמכים קיימים
        </p>
      </div>

      <ActionBarContainer
        actions={[
          {
            id: "refresh",
            label: "רענון",
            icon: RefreshCw,
            onClick: reload,
          },
        ]}
      />

      {error && (
        <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {loading && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">טוען...</p>
        )}
        {!loading && rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            אין מסמכים ממתינים
          </p>
        )}
        {!loading && rows.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <GitBranch className="h-4 w-4 shrink-0 text-gray-400" />
                    {row.documentNumber}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{row.title}</p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {row.projectName} · {row.kind} ·{" "}
                    {row.source === "workflow" ? "Workflow" : "Legacy"} ·{" "}
                    {formatRelative(row.sentAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
