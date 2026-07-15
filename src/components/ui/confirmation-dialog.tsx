"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardCheck,
  Info,
  Loader2,
  Send,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmationDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  /** Optional info callout under the description */
  info?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  loadingLabel?: string;
  /** Visual accent for the icon circle */
  variant?: "primary" | "danger";
  icon?: "send" | "clipboard" | LucideIcon;
  className?: string;
};

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  info,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  loading = false,
  loadingLabel = "שולח...",
  variant = "primary",
  icon = "send",
  className,
}: ConfirmationDialogProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  const IconComponent =
    icon === "send" ? Send : icon === "clipboard" ? ClipboardCheck : icon;

  const iconWrap =
    variant === "danger" ? "bg-red-50 text-red-600" : "bg-[#dbeafe] text-[#1e40af]";
  const confirmBtn =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-[#1e40af] hover:bg-[#1e3a8a]";

  async function handleConfirm() {
    if (loading) return;
    await onConfirm();
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wego-confirm-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/45"
            onClick={() => {
              if (!loading) onClose();
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "relative w-full max-w-[440px] bg-white rounded-[20px]",
              "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] p-8",
              className
            )}
          >
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "h-[72px] w-[72px] rounded-full flex items-center justify-center mb-5",
                  iconWrap
                )}
              >
                <IconComponent className="h-8 w-8" strokeWidth={2} />
              </div>

              <h2
                id="wego-confirm-title"
                className="text-[28px] font-bold leading-tight text-[#1e3a8a]"
              >
                {title}
              </h2>

              <div className="mt-4 text-[15px] leading-7 text-gray-600 max-w-[360px]">
                {description}
              </div>

              {info && (
                <div className="mt-5 w-full rounded-2xl bg-[#eff6ff] border border-[#bfdbfe] px-4 py-3 text-right flex gap-3 items-start">
                  <Info className="h-5 w-5 text-[#1e40af] shrink-0 mt-0.5" />
                  <p className="text-[13px] leading-6 text-[#1e40af]">{info}</p>
                </div>
              )}
            </div>

            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className={cn(
                  "h-12 rounded-xl border border-gray-300 bg-white text-gray-700",
                  "inline-flex items-center justify-center gap-2 font-semibold text-[15px]",
                  "transition-colors duration-200 hover:bg-gray-50",
                  "disabled:opacity-50 disabled:pointer-events-none"
                )}
              >
                <X className="h-4 w-4" />
                {cancelLabel}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleConfirm}
                className={cn(
                  "h-12 rounded-xl text-white",
                  "inline-flex items-center justify-center gap-2 font-semibold text-[15px]",
                  "transition-colors duration-200",
                  "disabled:opacity-70 disabled:pointer-events-none",
                  confirmBtn
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {loadingLabel}
                  </>
                ) : (
                  <>
                    <IconComponent className="h-4 w-4" />
                    {confirmLabel}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
