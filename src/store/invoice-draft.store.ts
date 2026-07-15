import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  removeLine: (boqItemId: string) => void;
  setQuantity: (boqItemId: string, quantity: number) => void;
  setLines: (lines: InvoiceDraftLine[]) => void;
  clear: () => void;
}

export const useInvoiceDraftStore = create<InvoiceDraftState>()(
  persist(
    (set, get) => ({
      projectId: null,
      lines: [],

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

      setLines: (lines) =>
        set({
          lines,
          projectId: lines.length > 0 ? lines[0].projectId : null,
        }),

      clear: () => set({ projectId: null, lines: [] }),
    }),
    { name: "wego-invoice-draft" }
  )
);
