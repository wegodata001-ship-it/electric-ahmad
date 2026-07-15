"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error";

type ToastItem = {
  id: string;
  tone: ToastTone;
  message: string;
  detail?: string;
};

type ToastContextValue = {
  toast: (opts: {
    tone: ToastTone;
    message: string;
    detail?: string;
    durationMs?: number;
  }) => void;
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: {
      tone: ToastTone;
      message: string;
      detail?: string;
      durationMs?: number;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [
        ...prev,
        {
          id,
          tone: opts.tone,
          message: opts.message,
          detail: opts.detail,
        },
      ]);
      window.setTimeout(() => dismiss(id), opts.durationMs ?? 4200);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message, detail) => toast({ tone: "success", message, detail }),
      error: (message, detail) => toast({ tone: "error", message, detail }),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 left-4 right-4 z-[110] flex flex-col gap-2 pointer-events-none sm:left-auto sm:right-4 sm:max-w-md">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className={cn(
                "pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg flex gap-3 items-start",
                item.tone === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-red-50 border-red-200 text-red-900"
              )}
            >
              {item.tone === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-5">{item.message}</p>
                {item.detail && (
                  <p className="text-xs mt-1 opacity-80 leading-5">
                    {item.detail}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
