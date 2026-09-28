"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImageIcon, Trash2, Eye } from "lucide-react";
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
  compact?: boolean;
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
  compact = false,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const urls = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );

  useEffect(() => {
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [urls]);

  function append(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files, ...Array.from(list)].slice(0, max);
    onChange(next);
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <span
        className={
          compact
            ? "block text-sm font-semibold text-[#334155]"
            : "block text-lg font-bold text-[#111827]"
        }
      >
        {label}
      </span>

      {stages && stages.length > 0 && onStageChange && (
        <select
          value={stage || stages[0]!.value}
          onChange={(e) => onStageChange(e.target.value)}
          className={
            compact
              ? "min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              : "min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold"
          }
        >
          {stages.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white",
            compact ? "min-h-11 text-sm font-bold" : "min-h-16 flex-col gap-1"
          )}
        >
          <Camera className={compact ? "h-4 w-4" : "h-6 w-6"} />
          <span className={compact ? "" : "text-sm font-black"}>מצלמה</span>
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-900",
            compact ? "min-h-11 text-sm font-bold" : "min-h-16 flex-col gap-1 border-2"
          )}
        >
          <ImageIcon className={compact ? "h-4 w-4" : "h-6 w-6"} />
          <span className={compact ? "" : "text-sm font-black"}>גלריה</span>
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
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[i]}
                alt=""
                className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 flex overflow-hidden rounded-b-lg">
                <button
                  type="button"
                  aria-label="צפייה"
                  onClick={() => setPreview(urls[i])}
                  className="grid h-5 flex-1 place-items-center bg-black/55 text-white"
                >
                  <Eye className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label="מחיקה"
                  onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                  className="grid h-5 flex-1 place-items-center bg-red-600/90 text-white"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            className="max-h-[80dvh] max-w-full rounded-xl object-contain"
          />
        </button>
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
