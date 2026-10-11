"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isActiveScanStatus,
  SCAN_STATUS,
  SCAN_STEP_LABELS,
  scanStepIndex,
} from "@/lib/ai/scan-job";

interface AiAnalyzeProgressProps {
  status: string;
  failed?: boolean;
  stillRunning?: boolean;
  error?: string | null;
}

export function AiAnalyzeProgress({
  status,
  failed,
  stillRunning,
  error,
}: AiAnalyzeProgressProps) {
  const done = status === SCAN_STATUS.COMPLETED || status === SCAN_STATUS.CONFIRMED;
  const stepIndex = scanStepIndex(status);
  const isFailed = Boolean(failed) || status === SCAN_STATUS.FAILED || status === SCAN_STATUS.TIMED_OUT;

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-8 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center mx-auto mb-4">
          {isFailed ? (
            <span className="text-2xl">⚠️</span>
          ) : done ? (
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          ) : (
            <Loader2 className="h-7 w-7 text-primary-600 animate-spin" />
          )}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {isFailed
            ? "לא הצלחנו להשלים את סריקת המסמך"
            : done
              ? "הסריקה הושלמה"
              : stillRunning
                ? "הסריקה עדיין רצה בשרת"
                : "AI סורק את המסמך"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {isFailed
            ? error || "הקובץ המקורי נשמר בפרויקט."
            : stillRunning
              ? "אפשר לעזוב את הדף. הסטטוס יישמר בפרויקט."
              : "הסריקה ממשיכה גם אם סוגרים את הדפדפן."}
        </p>
      </div>

      <div className="space-y-3">
        {SCAN_STEP_LABELS.map((step, index) => {
          const completed = done || index < stepIndex;
          const current =
            !done && !isFailed && isActiveScanStatus(status) && index === stepIndex;
          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 text-sm rounded-xl px-3 py-2.5 border",
                completed && "bg-green-50 border-green-100 text-green-800",
                current && "bg-primary-50 border-primary-100 text-primary-800",
                !completed && !current && "bg-gray-50 border-gray-100 text-gray-400"
              )}
            >
              {completed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : current ? (
                <Loader2 className="h-4 w-4 text-primary-600 animate-spin flex-shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-gray-300 flex-shrink-0" />
              )}
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
