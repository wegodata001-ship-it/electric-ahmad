"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Accessibility,
  ALargeSmall,
  Contrast,
  PauseCircle,
  RotateCcw,
  Space,
  Type,
  Underline,
  X,
} from "lucide-react";
import { useAccessibility } from "@/components/accessibility/accessibility-provider";
import { cn } from "@/lib/utils";

export function AccessibilityButton() {
  const {
    settings,
    increaseFont,
    decreaseFont,
    resetFont,
    toggleHighContrast,
    toggleGrayscale,
    toggleHighlightLinks,
    toggleReadableFont,
    toggleWideSpacing,
    toggleReduceMotion,
    resetAll,
  } = useAccessibility();

  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const fontPercent = Math.round(settings.fontScale * 100);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-3 z-[60] md:bottom-5"
    >
      <div className="pointer-events-auto relative flex flex-col items-start gap-2">
        {open && (
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${panelId}-title`}
            className="mb-1 w-[min(18.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[#DCE4EF] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.14)]"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-[#E8EEF6] px-3 py-2.5">
              <h2
                id={`${panelId}-title`}
                className="text-sm font-black text-[#0F172A]"
              >
                נגישות
              </h2>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                aria-label="סגירת תפריט נגישות"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(70vh,28rem)] space-y-1 overflow-y-auto p-2">
              <p className="px-2 pb-1 text-[11px] font-semibold text-[#64748B]">
                גודל טקסט · {fontPercent}%
              </p>
              <div className="mb-2 grid grid-cols-3 gap-1.5 px-1">
                <ActionChip
                  label="הקטנת טקסט"
                  short="A-"
                  onClick={decreaseFont}
                  active={settings.fontScale < 1}
                />
                <ActionChip
                  label="איפוס גודל טקסט"
                  short="A"
                  onClick={resetFont}
                  active={settings.fontScale === 1}
                />
                <ActionChip
                  label="הגדלת טקסט"
                  short="A+"
                  onClick={increaseFont}
                  active={settings.fontScale > 1}
                />
              </div>

              <ToggleRow
                icon={<Contrast className="h-4 w-4" />}
                label="ניגודיות גבוהה"
                pressed={settings.highContrast}
                onClick={toggleHighContrast}
              />
              <ToggleRow
                icon={<ALargeSmall className="h-4 w-4" />}
                label="גווני אפור"
                pressed={settings.grayscale}
                onClick={toggleGrayscale}
              />
              <ToggleRow
                icon={<Underline className="h-4 w-4" />}
                label="הדגשת קישורים"
                pressed={settings.highlightLinks}
                onClick={toggleHighlightLinks}
              />
              <ToggleRow
                icon={<Type className="h-4 w-4" />}
                label="גופן קריא"
                pressed={settings.readableFont}
                onClick={toggleReadableFont}
              />
              <ToggleRow
                icon={<Space className="h-4 w-4" />}
                label="הגדלת ריווח טקסט"
                pressed={settings.wideSpacing}
                onClick={toggleWideSpacing}
              />
              <ToggleRow
                icon={<PauseCircle className="h-4 w-4" />}
                label="עצירת אנימציות"
                pressed={settings.reduceMotion}
                onClick={toggleReduceMotion}
              />

              <button
                type="button"
                onClick={resetAll}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] px-3 py-2.5 text-sm font-bold text-[#0F172A] hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
              >
                <RotateCcw className="h-4 w-4" />
                איפוס הגדרות נגישות
              </button>
            </div>
          </div>
        )}

        <button
          ref={triggerRef}
          type="button"
          aria-label="פתיחת תפריט נגישות"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          title="נגישות"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "group relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#DCE4EF] bg-white text-[#0F172A] shadow-[0_4px_14px_rgba(15,23,42,0.12)] transition hover:border-[#2563EB] hover:text-[#2563EB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]",
            open && "border-[#2563EB] text-[#2563EB]"
          )}
        >
          <Accessibility className="h-5 w-5" aria-hidden />
          <span className="pointer-events-none absolute left-full top-1/2 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#0F172A] px-2 py-1 text-xs font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100 md:inline">
            נגישות
          </span>
        </button>
      </div>
    </div>
  );
}

function ActionChip({
  label,
  short,
  onClick,
  active,
}: {
  label: string;
  short: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded-xl border px-2 py-2.5 text-sm font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]",
        active
          ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
          : "border-[#DCE4EF] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
      )}
    >
      {short}
    </button>
  );
}

function ToggleRow({
  icon,
  label,
  pressed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-right text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]",
        pressed
          ? "border-[#2563EB] bg-[#EFF6FF] text-[#0F172A]"
          : "border-transparent text-[#334155] hover:bg-[#F8FAFC]"
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          pressed
            ? "bg-white text-[#2563EB]"
            : "bg-[#F1F5F9] text-[#64748B]"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          pressed ? "bg-[#2563EB]" : "bg-[#CBD5E1]"
        )}
        aria-hidden
      />
    </button>
  );
}
