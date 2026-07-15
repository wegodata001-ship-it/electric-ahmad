"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./button";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: "right" | "left";
  /** Wide drawer for execution reporting / manager workspace */
  size?: "md" | "lg" | "xl";
}

const sizeClass = {
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
} as const;

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
  size = "md",
}: DrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: side === "right" ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "right" ? "100%" : "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "absolute top-0 h-full w-full bg-white shadow-xl border-gray-200",
              sizeClass[size],
              side === "right" ? "right-0 border-l" : "left-0 border-r"
            )}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-5 overflow-y-auto h-[calc(100%-65px)]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
