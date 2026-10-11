"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { projectService } from "@/services";
import { Button } from "@/components/ui";
import {
  isActiveScanStatus,
  SCAN_STATUS,
} from "@/lib/ai/scan-job";
import type { ParsedContractBoqResult } from "@/lib/ai/types";

type Job = {
  id: string;
  status: string;
  documentId: string | null;
  itemsDetected: number;
  error: string | null;
  parsed: ParsedContractBoqResult | null;
};

export function ProjectScanStatusCard({ projectId }: { projectId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await projectService.getProjectScanJob(projectId);
        if (!cancelled) {
          setJob(
            result.job
              ? {
                  id: result.job.id,
                  status: result.job.status,
                  documentId: result.job.documentId,
                  itemsDetected: result.job.itemsDetected,
                  error: result.job.error,
                  parsed: (result.job.parsed as ParsedContractBoqResult | null) ?? null,
                }
              : null
          );
        }
      } catch {
        if (!cancelled) setJob(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (job && isActiveScanStatus(job.status)) void load();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [projectId, job?.status]);

  if (loading || !job) return null;
  if (job.status === SCAN_STATUS.CONFIRMED) return null;

  const active = isActiveScanStatus(job.status);
  const failed =
    job.status === SCAN_STATUS.FAILED || job.status === SCAN_STATUS.TIMED_OUT;
  const completed = job.status === SCAN_STATUS.COMPLETED;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">סריקת AI</p>
      <p className="mt-1 text-sm text-slate-600">
        {active && "הסריקה עדיין רצה בשרת."}
        {completed && `הסריקה הושלמה · ${job.itemsDetected} סעיפים ממתינים לבדיקה.`}
        {failed &&
          (job.error ||
            "לא הצלחנו להשלים את סריקת המסמך. הקובץ המקורי נשמר בפרויקט.")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/projects/new?projectId=${projectId}`}>
          <Button size="sm">
            {completed ? "המשך לבדיקה" : failed ? "נסה שוב" : "פתח סטטוס"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
