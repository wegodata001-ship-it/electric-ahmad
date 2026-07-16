"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deliveryNoteService } from "@/features/delivery-notes/services/delivery-note.service";
import type { DeliveryNote } from "@/types";
import { Button, Card } from "@/components/ui";
import { formatDate, formatNumber } from "@/utils/format";
import { Package, Plus, Eye, Printer } from "lucide-react";

export function DeliveryNotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);

  useEffect(() => {
    deliveryNoteService.getAll().then(setNotes);
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">תעודות משלוח</h1>
          <p className="text-sm text-gray-500 mt-1">{notes.length} תעודות</p>
        </div>
        <Button className="hidden md:inline-flex" onClick={() => router.push("/delivery-notes/new")}>
          <Plus className="h-4 w-4" />
          תעודת משלוח חדשה
        </Button>
      </div>

      <div className="space-y-3">
        {notes.length === 0 && (
          <Card padding="lg">
            <p className="text-sm text-gray-400 text-center">
              אין תעודות משלוח עדיין. צרו את התעודה הראשונה.
            </p>
          </Card>
        )}

        {notes.map((note) => (
          <Card key={note.id} padding="none">
            <div className="flex flex-wrap items-start gap-3 p-3 sm:p-5">
              <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5 text-primary-600" />
              </div>
              <button
                className="flex-1 min-w-[180px] text-right"
                onClick={() => router.push(`/delivery-notes/${note.id}`)}
              >
                <p className="text-sm font-semibold text-gray-900">
                  {note.noteNumber}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {note.client}
                  {note.projectName ? ` · ${note.projectName}` : ""}
                  {note.city ? ` · ${note.city}` : ""}
                  {" · "}
                  {note.items.length} פריטים
                </p>
              </button>
              <div className="text-right sm:text-left">
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(note.date)}
                </p>
                <p className="text-xs text-gray-400">
                  סה״כ כמות{" "}
                  {formatNumber(
                    note.items.reduce((s, i) => s + i.quantity, 0)
                  )}
                </p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto sm:gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-1 sm:flex-none"
                  title="צפייה"
                  onClick={() => router.push(`/delivery-notes/${note.id}`)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-1 sm:flex-none"
                  title="הדפסה / PDF"
                  onClick={() =>
                    window.open(`/print/delivery-notes/${note.id}`, "_blank")
                  }
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <button
        type="button"
        aria-label="תעודת משלוח חדשה"
        onClick={() => router.push("/delivery-notes/new")}
        className="fixed bottom-5 left-5 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-transform active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
