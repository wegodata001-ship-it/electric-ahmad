"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui";

type Report = {
  id: string;
  companyName: string;
  projectName: string;
  workSiteName: string | null;
  workDate: string | null;
  description: string;
  workSummary: string | null;
  reportedQty: number;
  photoCount: number;
};

export function PendingReportsInbox() {
  const [items, setItems] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await apiClient.get<{ items: Report[] }>("/api/subcontractor-reports");
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, action: "approve" | "partial" | "return") {
    setError("");
    try {
      await apiClient.patch(`/api/subcontractor-reports/${id}`, {
        action,
        reviewNotes: reason[id],
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "הפעולה נכשלה");
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-xl font-black">דיווחים ממתינים</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />}
      {!loading && !items.length && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500">
          אין דיווחים ממתינים לאישור
        </div>
      )}
      {items.map((item) => (
        <article key={item.id} className="rounded-2xl border bg-white p-4">
          <p className="font-black">{item.companyName}</p>
          <p className="text-sm text-slate-600">
            {item.projectName}
            {item.workSiteName ? ` · ${item.workSiteName}` : ""} · {item.workDate || "ללא תאריך"}
          </p>
          <p className="mt-2 text-sm">{item.workSummary || item.description}</p>
          <p className="mt-1 text-xs text-slate-500">
            כמות מדווחת: {item.reportedQty} · תמונות: {item.photoCount}
          </p>
          <textarea
            className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="סיבת החזרה לתיקון (חובה בהחזרה)"
            value={reason[item.id] ?? ""}
            onChange={(e) => setReason((p) => ({ ...p, [item.id]: e.target.value }))}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void act(item.id, "approve")}>אשר</Button>
            <Button variant="secondary" onClick={() => void act(item.id, "partial")}>
              אשר חלקית
            </Button>
            <Button variant="danger" onClick={() => void act(item.id, "return")}>
              החזר לתיקון
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
