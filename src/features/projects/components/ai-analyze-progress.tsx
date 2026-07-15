"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "upload", label: "הקובץ הועלה" },
  { id: "saved", label: "נשמר בשרת" },
  { id: "ai", label: "AI מנתח את המסמך..." },
  { id: "project", label: "מזהה פרטי פרויקט..." },
  { id: "boq", label: "קורא כתב כמויות..." },
  { id: "items", label: "יוצר סעיפים..." },
  { id: "calc", label: "מחשב כמויות..." },
  { id: "done", label: "מסיים..." },
];

interface AiAnalyzeProgressProps {
  active: boolean;
  done?: boolean;
  failed?: boolean;
}

export function AiAnalyzeProgress({ active, done, failed }: AiAnalyzeProgressProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active || done || failed) return;
    setStepIndex(0);
    const timer = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 2));
    }, 1600);
    return () => clearInterval(timer);
  }, [active, done, failed]);

  useEffect(() => {
    if (done) setStepIndex(STEPS.length - 1);
  }, [done]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-8 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center mx-auto mb-4">
          {failed ? (
            <span className="text-2xl">⚠️</span>
          ) : done ? (
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          ) : (
            <Loader2 className="h-7 w-7 text-primary-600 animate-spin" />
          )}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {failed
            ? "לא הצלחנו לזהות את כל הנתונים"
            : done
              ? "הניתוח הושלם"
              : "AI מנתח את המסמך"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {failed
            ? "הקובץ נשמר במערכת. אפשר לנסות שוב או להמשיך בהזנה ידנית."
            : "אל תסגור את החלון — העיבוד מתבצע בשרת"}
        </p>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const completed = done || index < stepIndex;
          const current = !done && !failed && index === stepIndex;
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
