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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">תעודות משלוח</h1>
          <p className="text-sm text-gray-500 mt-1">{notes.length} תעודות</p>
        </div>
        <Button onClick={() => router.push("/delivery-notes/new")}>
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
            <div className="flex items-center gap-4 p-5">
              <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5 text-primary-600" />
              </div>
              <button
                className="flex-1 min-w-0 text-right"
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
              <div className="text-left">
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
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="צפייה"
                  onClick={() => router.push(`/delivery-notes/${note.id}`)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
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
    </div>
  );
}
