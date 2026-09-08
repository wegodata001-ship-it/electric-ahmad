"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Save, Send, Trash2 } from "lucide-react";
import { fieldService } from "@/features/field/services/field.service";
import { opsDeliveryNotesService, workDiariesService } from "@/features/work-diaries/services/work-diaries.service";
import { RevisionFeedbackBanner } from "@/features/approvals/components/revision-feedback-banner";
import { ManualCorrectionEditor } from "@/features/approvals/components/manual-correction-editor";

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  revision: "נדחה",
  pending_approval: "נשלח לאישור",
  approved: "מאושר",
  sent_to_client: "נשלח ללקוח",
  signed: "נחתם על ידי הלקוח",
  closed: "נסגר",
};

export function FieldDeliveryNotesListPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    opsDeliveryNotesService
      .list()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#03142F]">תעודות משלוח</h1>
          <p className="text-sm text-gray-500 mt-1">יצירה ושליחה לאישור</p>
        </div>
        <Link
          href="/field/delivery-notes/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#1e40af] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          תעודה חדשה
        </Link>
      </div>
      {loading && <p className="text-sm text-gray-500">טוען…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/field/delivery-notes/${item.id}`}
            className="block rounded-2xl border border-gray-200 bg-white p-4"
          >
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-bold">{item.documentNumber}</p>
                <p className="text-sm text-gray-600">{item.clientName}</p>
                <p className="text-xs text-gray-400">{item.noteDate}</p>
              </div>
              <span className="text-xs font-semibold text-gray-600">
                {STATUS_LABEL[item.status] ?? item.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function FieldDeliveryNoteBuildPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<{ id: string; name: string; contractor: string; location: string }[]>([]);
  const [docNumber, setDocNumber] = useState("…");
  const [projectId, setProjectId] = useState("");
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ key: "1", description: "", unit: "יח'", quantity: "", notes: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fieldService.getDashboard(), opsDeliveryNotesService.peekNumber()])
      .then(([dash, peek]) => {
        setProjects(dash.projects);
        setDocNumber(peek.documentNumber);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function save() {
    if (!clientName.trim()) {
      setError("יש להזין שם לקוח");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const note = await opsDeliveryNotesService.create({
        projectId: projectId || null,
        noteDate,
        clientName: clientName.trim(),
        address,
        vehicleNumber,
        driverName,
        notes,
        items: items
          .filter((i) => i.description.trim())
          .map((i) => ({
            description: i.description.trim(),
            unit: i.unit || "יח'",
            quantity: Number(i.quantity) || 0,
            notes: i.notes || null,
          })),
      });
      router.replace(`/field/delivery-notes/${note.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <Link href="/field/delivery-notes">
          <ArrowRight className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">תעודת משלוח חדשה</h1>
          <p className="text-sm text-gray-500">{docNumber}</p>
        </div>
      </div>
      {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
      <section className="rounded-2xl bg-white border p-4 space-y-3">
        <select
          className="w-full rounded-xl border px-3 py-2.5"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            const p = projects.find((x) => x.id === e.target.value);
            if (p) {
              setClientName(p.contractor || "");
              setAddress(p.location || "");
            }
          }}
        >
          <option value="">פרויקט (אופציונלי)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="w-full rounded-xl border px-3 py-2.5"
          value={noteDate}
          onChange={(e) => setNoteDate(e.target.value)}
        />
        <input
          className="w-full rounded-xl border px-3 py-2.5"
          placeholder="לקוח"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />
        <input
          className="w-full rounded-xl border px-3 py-2.5"
          placeholder="כתובת"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded-xl border px-3 py-2.5"
            placeholder="מספר רכב"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
          />
          <input
            className="rounded-xl border px-3 py-2.5"
            placeholder="נהג"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
          />
        </div>
        <textarea
          className="w-full rounded-xl border px-3 py-2.5 min-h-20"
          placeholder="הערות"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>
      <section className="rounded-2xl bg-white border p-4 space-y-3">
        <div className="flex justify-between">
          <h2 className="font-bold">פירוט ציוד</h2>
          <button
            type="button"
            className="text-sm text-[#1e40af] font-semibold"
            onClick={() =>
              setItems((r) => [
                ...r,
                { key: String(Date.now()), description: "", unit: "יח'", quantity: "", notes: "" },
              ])
            }
          >
            + שורה
          </button>
        </div>
        {items.map((row) => (
          <div key={row.key} className="flex gap-2">
            <input
              className="flex-1 rounded-xl border px-3 py-2 text-sm"
              placeholder="תיאור"
              value={row.description}
              onChange={(e) =>
                setItems((r) =>
                  r.map((x) => (x.key === row.key ? { ...x, description: e.target.value } : x))
                )
              }
            />
            <input
              className="w-20 rounded-xl border px-3 py-2 text-sm"
              placeholder="כמות"
              value={row.quantity}
              onChange={(e) =>
                setItems((r) =>
                  r.map((x) => (x.key === row.key ? { ...x, quantity: e.target.value } : x))
                )
              }
            />
            <button type="button" onClick={() => setItems((r) => r.filter((x) => x.key !== row.key))}>
              <Trash2 className="h-4 w-4 text-red-400" />
            </button>
          </div>
        ))}
      </section>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="w-full rounded-xl bg-[#1e40af] py-3.5 text-sm font-bold text-white inline-flex items-center justify-center gap-2"
      >
        <Save className="h-4 w-4" />
        {saving ? "שומר…" : "שמור תעודה"}
      </button>
    </div>
  );
}

export function FieldDeliveryNoteDetailPage({ id }: { id: string }) {
  const [note, setNote] = useState<any>(null);
  const [error, setError] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [approvers, setApprovers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);

  function reload() {
    return opsDeliveryNotesService.get(id).then(setNote);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function openSubmit() {
    setShowSubmit(true);
    const r = await workDiariesService.listApprovers();
    setApprovers(r.items);
  }

  async function submit() {
    setBusy(true);
    try {
      const updated = await opsDeliveryNotesService.submit(id, selected);
      setNote(updated);
      setShowSubmit(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function resubmitPreviousCycle() {
    const rows = note.approvals || [];
    const latest = Math.max(
      ...rows.map((approval: any) =>
        new Date(approval.sentAt || approval.createdAt || 0).getTime()
      )
    );
    const ids = [
      ...new Set(
        rows
          .filter(
            (approval: any) =>
              latest -
                new Date(
                  approval.sentAt || approval.createdAt || 0
                ).getTime() <
              5_000
          )
          .map((approval: any) => approval.approver?.id)
          .filter(Boolean)
      ),
    ] as string[];
    if (!ids.length) throw new Error("לא נמצאו מאשרים מהסבב הקודם");
    const updated = await opsDeliveryNotesService.submit(id, ids);
    setNote(updated);
    setShowCorrection(false);
  }

  if (!note && !error) return <p className="text-sm text-gray-500">טוען…</p>;
  if (!note) return <p className="text-red-600">{error}</p>;

  const editable = note.status === "draft" || note.status === "revision";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/field/delivery-notes">
          <ArrowRight className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">{note.documentNumber}</h1>
          <p className="text-sm text-gray-500">{STATUS_LABEL[note.status] ?? note.status}</p>
        </div>
      </div>
      {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>}
      {note.status === "revision" && (
        <RevisionFeedbackBanner comment={note.rejectionComment} />
      )}
      {note.status === "revision" && !showCorrection && (
        <button
          type="button"
          onClick={() => setShowCorrection(true)}
          className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white"
        >
          ערוך ותקן
        </button>
      )}
      {showCorrection && note.status === "revision" && (
        <ManualCorrectionEditor
          kind="delivery_note"
          document={note}
          creatorMode
          onSaved={reload}
          onResubmit={resubmitPreviousCycle}
        />
      )}
      {editable && note.status !== "revision" && (
        <button
          type="button"
          onClick={openSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1e40af] px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Send className="h-4 w-4" />
          שלח לאישור
        </button>
      )}
      <section className="rounded-2xl bg-white border p-4 text-sm space-y-2">
        <p>לקוח: {note.clientName}</p>
        <p>כתובת: {note.address || "—"}</p>
        <p>
          רכב / נהג: {[note.vehicleNumber, note.driverName].filter(Boolean).join(" · ") || "—"}
        </p>
      </section>
      {!!note.items?.length && (
        <section className="rounded-2xl bg-white border p-4">
          <h2 className="font-bold mb-2">פירוט</h2>
          {note.items.map((i: any) => (
            <div key={i.id} className="flex justify-between text-sm py-1">
              <span>{i.description}</span>
              <span>
                {i.quantity} {i.unit}
              </span>
            </div>
          ))}
        </section>
      )}
      {showSubmit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 space-y-3">
            <h3 className="font-bold">בחירת מאשרים</h3>
            {approvers.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(a.id)}
                  onChange={() =>
                    setSelected((s) =>
                      s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]
                    )
                  }
                />
                {a.name} ({a.roleLabel})
              </label>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="w-full rounded-xl bg-[#1e40af] py-3 text-white font-bold text-sm"
            >
              שלח
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
