"use client";

import Link from "next/link";
import { Hammer, BookOpen, Plus } from "lucide-react";

/** Field execution entry — wires to Work Diary (existing workflow) */
export function FieldExecutionPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ביצוע</h1>
        <p className="mt-1 text-sm text-gray-500">
          דיווח ביצוע מתבצע דרך יומן עבודה + Workflow — ללא מסלול מקביל
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/field/work-diaries/new"
          className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50/60 p-4 font-medium text-teal-900"
        >
          <Plus className="h-5 w-5" />
          יומן עבודה חדש
        </Link>
        <Link
          href="/field/work-diaries"
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 font-medium text-gray-800"
        >
          <BookOpen className="h-5 w-5 text-teal-700" />
          כל יומני העבודה
        </Link>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-500">
        <div className="mb-2 flex items-center gap-2 font-semibold text-gray-700">
          <Hammer className="h-4 w-4" />
          זרימת ביצוע
        </div>
        טיוטה → שליחה לאישור → אישור משרד → (אופציונלי) קישור לקוח / WhatsApp
      </div>
    </div>
  );
}
