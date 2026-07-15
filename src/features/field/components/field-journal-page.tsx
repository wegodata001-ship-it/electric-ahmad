"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { fieldService } from "@/features/field/services/field.service";
import type { FieldCrewMember, WorkJournal } from "@/types";
import { computeTotalHours } from "@/utils/work-hours";
import { ConfirmationDialog, useToast } from "@/components/ui";

type WorkerRow = {
  crewMemberId: string;
  workerName: string;
  profession: string;
  selected: boolean;
  startTime: string;
  endTime: string;
  status: string;
  note: string;
};

const inputClass =
  "w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base bg-white disabled:bg-gray-100";

export function FieldJournalPage({ journalId }: { journalId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [journal, setJournal] = useState<WorkJournal | null>(null);
  const [projects, setProjects] = useState<
    { id: string; name: string; location: string; contractor: string }[]
  >([]);
  const [crew, setCrew] = useState<FieldCrewMember[]>([]);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [form, setForm] = useState({
    date: "",
    projectId: "",
    clientName: "",
    address: "",
    workArea: "",
    generalNotes: "",
    actionsPerformed: "",
    exceptions: "",
    equipment: "",
    notes: "",
    signed: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  const isSubmitted = journal?.status === "submitted";
  /** Fields stay editable after send; changes re-sync to the office. */
  const locked = false;

  const load = useCallback(async () => {
    const [j, dash, myCrew] = await Promise.all([
      fieldService.getJournal(journalId),
      fieldService.getDashboard(),
      fieldService.getCrew(),
    ]);
    setJournal(j);
    setProjects(dash.projects);
    setCrew(myCrew.filter((c) => c.status === "active"));
    setForm({
      date: j.date,
      projectId: j.projectId,
      clientName: j.clientName,
      address: j.address,
      workArea: j.workArea,
      generalNotes: j.generalNotes,
      actionsPerformed: j.actionsPerformed,
      exceptions: j.exceptions,
      equipment: j.equipment,
      notes: j.notes,
      signed: !!j.signatureData,
    });

    const selected = new Map(j.workers.map((w) => [w.crewMemberId, w]));
    const rows: WorkerRow[] = myCrew
      .filter((c) => c.status === "active")
      .map((c) => {
        const existing = selected.get(c.id);
        return {
          crewMemberId: c.id,
          workerName: c.name,
          profession: c.profession,
          selected: !!existing,
          startTime: existing?.startTime || "07:00",
          endTime: existing?.endTime || "16:00",
          status: existing?.status || "present",
          note: existing?.note || "",
        };
      });

    // Keep workers from journal who might be inactive now
    for (const w of j.workers) {
      if (!rows.some((r) => r.crewMemberId === w.crewMemberId)) {
        rows.push({
          crewMemberId: w.crewMemberId,
          workerName: w.workerName,
          profession: w.profession,
          selected: true,
          startTime: w.startTime || "07:00",
          endTime: w.endTime || "16:00",
          status: w.status || "present",
          note: w.note || "",
        });
      }
    }
    setWorkers(rows);
  }, [journalId]);

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof Error ? err.message : "שגיאה בטעינת היומן")
    );
  }, [load]);

  const payload = useMemo(
    () => ({
      projectId: form.projectId,
      date: form.date,
      clientName: form.clientName,
      address: form.address,
      workArea: form.workArea,
      generalNotes: form.generalNotes,
      actionsPerformed: form.actionsPerformed,
      exceptions: form.exceptions,
      equipment: form.equipment,
      notes: form.notes,
      signatureData: form.signed ? "signed" : null,
      workers: workers
        .filter((w) => w.selected)
        .map((w) => ({
          crewMemberId: w.crewMemberId,
          startTime: w.startTime,
          endTime: w.endTime,
          status: w.status,
          note: w.note,
        })),
    }),
    [form, workers]
  );

  async function saveDraft() {
    if (!journal || locked) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await fieldService.saveJournal(journal.id, payload);
      setJournal(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function confirmAndSubmit() {
    if (!journal || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await fieldService.saveJournal(journal.id, payload);
      await fieldService.submitJournal(journal.id);
      setConfirmSendOpen(false);
      toast.success("יומן העבודה נשלח בהצלחה למנהל הפרויקט.");
      router.replace("/field");
    } catch {
      toast.error(
        "שליחת היומן נכשלה.",
        "נסה שוב בעוד מספר רגעים."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length || !journal || locked) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await fieldService.uploadMedia(journal.id, file);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהעלאה");
    } finally {
      setUploading(false);
    }
  }

  function onProjectChange(id: string) {
    const p = projects.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      projectId: id,
      clientName: p?.contractor || f.clientName,
      address: p?.location || f.address,
    }));
  }

  if (error && !journal) {
    return (
      <div className="rounded-2xl bg-white border border-red-100 p-5 text-red-600">
        {error}
      </div>
    );
  }

  if (!journal) {
    return <p className="text-center text-gray-400 py-16 text-lg">טוען יומן...</p>;
  }

  const selectedWorkers = workers.filter((w) => w.selected);

  return (
    <div className="space-y-4 lg:space-y-6 pb-8">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button
            type="button"
            onClick={() => router.push("/field")}
            className="text-sm text-gray-500 mb-2"
          >
            ← חזרה
          </button>
          <h1 className="text-2xl lg:text-3xl font-bold">יומן עבודה</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSubmitted
              ? "נשלח למנהל הפרויקט · ניתן לערוך ולסנכרן"
              : "טיוטה — ניתן לערוך"}
          </p>
        </div>
      </div>

      {/* פרטי היומן */}
      <Section title="פרטי היומן">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Labeled label="תאריך">
            <input
              type="date"
              disabled={locked}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={inputClass}
            />
          </Labeled>
          <Labeled label="פרויקט">
            <select
              disabled={locked}
              value={form.projectId}
              onChange={(e) => onProjectChange(e.target.value)}
              className={inputClass}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="לקוח">
            <input
              disabled={locked}
              value={form.clientName}
              onChange={(e) =>
                setForm((f) => ({ ...f, clientName: e.target.value }))
              }
              className={inputClass}
            />
          </Labeled>
          <Labeled label="כתובת">
            <input
              disabled={locked}
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
              className={inputClass}
            />
          </Labeled>
          <Labeled label="אזור עבודה">
            <input
              disabled={locked}
              value={form.workArea}
              onChange={(e) =>
                setForm((f) => ({ ...f, workArea: e.target.value }))
              }
              className={inputClass}
              placeholder="קומה / אזור"
            />
          </Labeled>
          <Labeled label="הערות כלליות">
            <input
              disabled={locked}
              value={form.generalNotes}
              onChange={(e) =>
                setForm((f) => ({ ...f, generalNotes: e.target.value }))
              }
              className={inputClass}
            />
          </Labeled>
        </div>
      </Section>

      {/* עובדים */}
      <Section title="עובדים">
        {!locked && (
          <button
            type="button"
            onClick={() => setShowAddWorker((v) => !v)}
            className="mb-3 h-12 px-4 rounded-xl border-2 border-[#1e40af] text-[#1e40af] font-bold"
          >
            {showAddWorker ? "סגור בחירה" : "הוסף עובד"}
          </button>
        )}

        {showAddWorker && !locked && (
          <div className="mb-4 rounded-xl border border-gray-200 p-3 space-y-2 bg-[#fafbfc]">
            <p className="text-sm text-gray-500">בחר מהרשימה שלך</p>
            {crew.map((c) => {
              const row = workers.find((w) => w.crewMemberId === c.id);
              const checked = !!row?.selected;
              return (
                <label
                  key={c.id}
                  className="flex items-center gap-3 text-base py-2"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={checked}
                    onChange={(e) => {
                      setWorkers((prev) =>
                        prev.map((w) =>
                          w.crewMemberId === c.id
                            ? { ...w, selected: e.target.checked }
                            : w
                        )
                      );
                    }}
                  />
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-gray-400 text-sm">
                    {c.profession || ""}
                  </span>
                </label>
              );
            })}
            {crew.length === 0 && (
              <p className="text-sm text-gray-400">
                הרשימה ריקה — הוסף עובדים ב«עובדים שלי»
              </p>
            )}
          </div>
        )}

        {/* Mobile worker cards */}
        <div className="space-y-3 lg:hidden">
          {selectedWorkers.map((w) => (
            <WorkerCard
              key={w.crewMemberId}
              w={w}
              locked={locked}
              onChange={(next) =>
                setWorkers((prev) =>
                  prev.map((x) =>
                    x.crewMemberId === w.crewMemberId ? next : x
                  )
                )
              }
              onRemove={() =>
                setWorkers((prev) =>
                  prev.map((x) =>
                    x.crewMemberId === w.crewMemberId
                      ? { ...x, selected: false }
                      : x
                  )
                )
              }
            />
          ))}
          {selectedWorkers.length === 0 && (
            <p className="text-gray-400 text-sm">לא נבחרו עובדים</p>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#1e3a8a] text-white">
                <th className="text-right px-2 py-2">עובד</th>
                <th className="text-right px-2 py-2">מקצוע</th>
                <th className="text-right px-2 py-2">כניסה</th>
                <th className="text-right px-2 py-2">יציאה</th>
                <th className="text-right px-2 py-2">סה״כ</th>
                <th className="text-right px-2 py-2">סטטוס</th>
                <th className="text-right px-2 py-2">הערות</th>
                {!locked && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {selectedWorkers.map((w, i) => (
                <tr
                  key={w.crewMemberId}
                  className={i % 2 ? "bg-gray-50" : "bg-white"}
                >
                  <td className="px-2 py-2 font-semibold">{w.workerName}</td>
                  <td className="px-2 py-2">{w.profession || "—"}</td>
                  <td className="px-2 py-2">
                    <input
                      type="time"
                      disabled={locked}
                      value={w.startTime}
                      className="border rounded-lg px-2 py-1"
                      onChange={(e) =>
                        setWorkers((prev) =>
                          prev.map((x) =>
                            x.crewMemberId === w.crewMemberId
                              ? { ...x, startTime: e.target.value }
                              : x
                          )
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="time"
                      disabled={locked}
                      value={w.endTime}
                      className="border rounded-lg px-2 py-1"
                      onChange={(e) =>
                        setWorkers((prev) =>
                          prev.map((x) =>
                            x.crewMemberId === w.crewMemberId
                              ? { ...x, endTime: e.target.value }
                              : x
                          )
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-2 font-semibold">
                    {computeTotalHours(w.startTime, w.endTime)}
                  </td>
                  <td className="px-2 py-2">
                    <select
                      disabled={locked}
                      value={w.status}
                      className="border rounded-lg px-2 py-1"
                      onChange={(e) =>
                        setWorkers((prev) =>
                          prev.map((x) =>
                            x.crewMemberId === w.crewMemberId
                              ? { ...x, status: e.target.value }
                              : x
                          )
                        )
                      }
                    >
                      <option value="present">נוכח</option>
                      <option value="half">חצי יום</option>
                      <option value="absent">נעדר</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      disabled={locked}
                      value={w.note}
                      className="border rounded-lg px-2 py-1 w-full"
                      onChange={(e) =>
                        setWorkers((prev) =>
                          prev.map((x) =>
                            x.crewMemberId === w.crewMemberId
                              ? { ...x, note: e.target.value }
                              : x
                          )
                        )
                      }
                    />
                  </td>
                  {!locked && (
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="text-red-600 text-xs"
                        onClick={() =>
                          setWorkers((prev) =>
                            prev.map((x) =>
                              x.crewMemberId === w.crewMemberId
                                ? { ...x, selected: false }
                                : x
                            )
                          )
                        }
                      >
                        הסר
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="ציוד (אופציונלי)">
        <textarea
          disabled={locked}
          value={form.equipment}
          onChange={(e) =>
            setForm((f) => ({ ...f, equipment: e.target.value }))
          }
          className={`${inputClass} min-h-24`}
          placeholder="ציוד ששימש היום..."
        />
      </Section>

      <Section title="תמונות">
        {!locked && (
          <label className="block w-full h-14 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-base font-bold text-gray-600 cursor-pointer bg-white">
            {uploading ? "מעלה..." : "צלם / בחר מהגלריה"}
            <input
              type="file"
              accept="image/*,video/*"
              capture="environment"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
        )}
        <div className="mt-3 grid grid-cols-3 lg:grid-cols-6 gap-2">
          {journal.media.map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noreferrer"
              className="aspect-square rounded-lg overflow-hidden bg-gray-100 border"
            >
              {m.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.thumbnailUrl || m.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs flex h-full items-center justify-center text-gray-400">
                  סרטון
                </span>
              )}
            </a>
          ))}
        </div>
      </Section>

      <Section title="פעולות שבוצעו">
        <textarea
          disabled={locked}
          value={form.actionsPerformed}
          onChange={(e) =>
            setForm((f) => ({ ...f, actionsPerformed: e.target.value }))
          }
          className={`${inputClass} min-h-36`}
          placeholder="בוצע חיבור לוחות...&#10;בוצעה השחלת כבלים..."
        />
      </Section>

      <Section title="חריגות">
        <textarea
          disabled={locked}
          value={form.exceptions}
          onChange={(e) =>
            setForm((f) => ({ ...f, exceptions: e.target.value }))
          }
          className={`${inputClass} min-h-24`}
          placeholder="אם יש חריגות — פרט כאן"
        />
      </Section>

      <Section title="חתימה (אופציונלי)">
        <label className="flex items-center gap-3 text-base">
          <input
            type="checkbox"
            disabled={locked}
            checked={form.signed}
            className="h-5 w-5"
            onChange={(e) =>
              setForm((f) => ({ ...f, signed: e.target.checked }))
            }
          />
          מאשר את תוכן היומן
        </label>
      </Section>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <div className="sticky bottom-20 lg:bottom-4 space-y-2 pt-2 bg-[#f4f6f8]/95 pb-2">
        <button
          type="button"
          onClick={saveDraft}
          disabled={saving || submitting}
          className="w-full h-14 rounded-2xl border-2 border-[#1e40af] text-[#1e40af] text-lg font-bold bg-white disabled:opacity-50"
        >
          {saving
            ? "שומר..."
            : isSubmitted
              ? "שמור וסנכרן"
              : "שמור טיוטה"}
        </button>
        {!isSubmitted && (
          <button
            type="button"
            onClick={() => setConfirmSendOpen(true)}
            disabled={saving || submitting}
            className="w-full h-16 rounded-2xl bg-emerald-600 text-white text-lg font-bold disabled:opacity-50"
          >
            שלח למנהל הפרויקט
          </button>
        )}
      </div>

      <ConfirmationDialog
        open={confirmSendOpen}
        onClose={() => {
          if (!submitting) setConfirmSendOpen(false);
        }}
        onConfirm={confirmAndSubmit}
        loading={submitting}
        loadingLabel="שולח..."
        icon="send"
        title="שליחת יומן עבודה"
        confirmLabel="שלח למנהל הפרויקט"
        cancelLabel="ביטול"
        description={
          <>
            <p className="font-medium text-gray-800 mb-2">
              האם לשלוח את יומן העבודה למנהל הפרויקט?
            </p>
            <p>
              לאחר השליחה היומן יועבר למערכת מנהל הפרויקט,
              <br />
              ויכלול את העובדים, שעות העבודה, התמונות,
              <br />
              הציוד וכל הדיווחים שנרשמו.
            </p>
          </>
        }
        info="ניתן לערוך את היומן גם לאחר השליחה, וכל שינוי יסונכרן מחדש למנהל הפרויקט."
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white border border-gray-200 p-4 lg:p-6">
      <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-gray-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function WorkerCard({
  w,
  locked,
  onChange,
  onRemove,
}: {
  w: WorkerRow;
  locked: boolean;
  onChange: (w: WorkerRow) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-[#fafbfc] space-y-2">
      <div className="flex justify-between">
        <div>
          <p className="font-bold text-base">{w.workerName}</p>
          <p className="text-sm text-gray-500">{w.profession || "—"}</p>
        </div>
        {!locked && (
          <button type="button" onClick={onRemove} className="text-red-600 text-sm">
            הסר
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-xs text-gray-500">כניסה</span>
          <input
            type="time"
            disabled={locked}
            value={w.startTime}
            className={inputClass}
            onChange={(e) => onChange({ ...w, startTime: e.target.value })}
          />
        </div>
        <div>
          <span className="text-xs text-gray-500">יציאה</span>
          <input
            type="time"
            disabled={locked}
            value={w.endTime}
            className={inputClass}
            onChange={(e) => onChange({ ...w, endTime: e.target.value })}
          />
        </div>
      </div>
      <p className="text-sm">
        סה״כ שעות:{" "}
        <strong>{computeTotalHours(w.startTime, w.endTime)}</strong>
      </p>
      <select
        disabled={locked}
        value={w.status}
        className={inputClass}
        onChange={(e) => onChange({ ...w, status: e.target.value })}
      >
        <option value="present">נוכח</option>
        <option value="half">חצי יום</option>
        <option value="absent">נעדר</option>
      </select>
      <input
        disabled={locked}
        value={w.note}
        placeholder="הערות"
        className={inputClass}
        onChange={(e) => onChange({ ...w, note: e.target.value })}
      />
    </div>
  );
}
