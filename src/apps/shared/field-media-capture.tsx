"use client";

import { useRef } from "react";
import { Camera, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MediaStageOption = { value: string; label: string };

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  stage?: string;
  onStageChange?: (stage: string) => void;
  stages?: MediaStageOption[];
  max?: number;
  label?: string;
};

/**
 * Mobile photo capture: explicit Camera + Gallery buttons.
 * Files stay local until parent uploads to Storage after document create.
 */
export function FieldMediaCapture({
  files,
  onChange,
  stage,
  onStageChange,
  stages,
  max = 8,
  label = "תמונות",
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function append(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files, ...Array.from(list)].slice(0, max);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <span className="block text-lg font-bold text-[#111827]">{label}</span>

      {stages && stages.length > 0 && onStageChange && (
        <select
          value={stage || stages[0]!.value}
          onChange={(e) => onStageChange(e.target.value)}
          className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold"
        >
          {stages.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-slate-900 text-white"
        >
          <Camera className="h-6 w-6" />
          <span className="text-sm font-black">מצלמה</span>
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-slate-200 bg-white text-slate-900"
        >
          <ImageIcon className="h-6 w-6" />
          <span className="text-sm font-black">גלריה</span>
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          append(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          append(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <button
              key={`${f.name}-${i}`}
              type="button"
              onClick={() => onChange(files.filter((_, idx) => idx !== i))}
              className={cn(
                "rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700"
              )}
              title="הסר"
            >
              {f.name.slice(0, 18)}
              {f.name.length > 18 ? "…" : ""} ×
            </button>
          ))}
          <p className="w-full text-sm text-slate-500">
            {files.length} תמונות נבחרו (לחיצה להסרה)
          </p>
        </div>
      )}
    </div>
  );
}

export const DIARY_PHOTO_STAGES: MediaStageOption[] = [
  { value: "site", label: "תמונות מהאתר" },
  { value: "execution", label: "תמונות ביצוע" },
  { value: "before", label: "לפני" },
  { value: "after", label: "אחרי" },
  { value: "other", label: "אחר" },
];

export const DN_PHOTO_STAGES: MediaStageOption[] = [
  { value: "cargo", label: "תמונות הסחורה" },
  { value: "unloading", label: "תמונות הפריקה" },
  { value: "damage", label: "תמונות נזק" },
  { value: "other", label: "אחר" },
];
