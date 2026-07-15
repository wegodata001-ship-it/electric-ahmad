import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BoqItem } from "@/types";
import { availableForInvoice } from "@/utils/invoice-calc";

export interface InvoiceDraftLine {
  boqItemId: string;
  projectId: string;
  code: string;
  description: string;
  unit: string;
  contractQuantity: number;
  executedQuantity: number;
  invoicedQuantity: number;
  availableForInvoice: number;
  unitPrice: number;
  quantity: number;
}

interface InvoiceDraftState {
  projectId: string | null;
  lines: InvoiceDraftLine[];
  addFromBoq: (item: BoqItem) => { ok: boolean; reason?: string };
  removeLine: (boqItemId: string) => void;
  setQuantity: (boqItemId: string, quantity: number) => void;
  clear: () => void;
}

function toLine(item: BoqItem, quantity?: number): InvoiceDraftLine {
  const executed = item.executedQuantity ?? item.completedQuantity;
  const invoiced = item.invoicedQuantity ?? 0;
  const available =
    item.availableForInvoice ?? availableForInvoice(executed, invoiced);
  return {
    boqItemId: item.id,
    projectId: item.projectId,
    code: item.code,
    description: item.description,
    unit: item.unit,
    contractQuantity: item.contractQuantity,
    executedQuantity: executed,
    invoicedQuantity: invoiced,
    availableForInvoice: available,
    unitPrice: item.unitPrice,
    quantity: quantity ?? available,
  };
}

export const useInvoiceDraftStore = create<InvoiceDraftState>()(
  persist(
    (set, get) => ({
      projectId: null,
      lines: [],

      addFromBoq: (item) => {
        const available =
          item.availableForInvoice ??
          availableForInvoice(
            item.executedQuantity ?? item.completedQuantity,
            item.invoicedQuantity ?? 0
          );
        if (available <= 0) {
          return { ok: false, reason: "אין כמות זמינה לחשבון" };
        }

        const state = get();
        if (state.projectId && state.projectId !== item.projectId) {
          return {
            ok: false,
            reason: "החשבון הנוכחי שייך לפרויקט אחר — נקו את הטיוטה תחילה",
          };
        }

        const existing = state.lines.find((l) => l.boqItemId === item.id);
        if (existing) {
          return { ok: true };
        }

        set({
          projectId: item.projectId,
          lines: [...state.lines, toLine(item)],
        });
        return { ok: true };
      },

      removeLine: (boqItemId) =>
        set((s) => {
          const lines = s.lines.filter((l) => l.boqItemId !== boqItemId);
          return { lines, projectId: lines.length ? s.projectId : null };
        }),

      setQuantity: (boqItemId, quantity) =>
        set((s) => ({
          lines: s.lines.map((l) => {
            if (l.boqItemId !== boqItemId) return l;
            const qty = Math.min(
              Math.max(0, quantity),
              l.availableForInvoice
            );
            return { ...l, quantity: qty };
          }),
        })),

      clear: () => set({ projectId: null, lines: [] }),
    }),
    { name: "wego-invoice-draft" }
  )
);
