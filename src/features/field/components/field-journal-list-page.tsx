"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, Clock, Plus, Users, X } from "lucide-react";
import { fieldService } from "@/features/field/services/field.service";
import type { FieldCrewMember, WorkJournal } from "@/types";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/format";

const EQUIPMENT_OPTIONS = [
  "מולטימטר",
  "כלי חשמלאי",
  "סולם",
  "מקדחה",
  "כבלים / חוטים",
  "לוחות / אביזרים",
  "ציוד בטיחות",
];

const inputClass =
  "w-full min-h-12 border border-gray-300 rounded-xl px-3.5 py-3 text-base bg-white";

type FormState = {
  date: string;
  projectId: string;
  clientName: string;
  address: string;
  workArea: string;
  actionsPerformed: string;
  notes: string;
  equipment: string[];
  selectedWorkers: string[];
};

export function FieldJournalListPage() {
  const router = useRouter();
  const toast = useToast();
  const [journals, setJournals] = useState<WorkJournal[]>([]);
  const [projects, setProjects] = useState<
    { id: string; name: string; location: string; contractor: string }[]
  >([]);
  const [crew, setCrew] = useState<FieldCrewMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    date: new Date().toISOString().slice(0, 10),
    projectId: "",
    clientName: "",
    address: "",
    workArea: "",
    actionsPerformed: "",
    notes: "",
    equipment: [],
    selectedWorkers: [],
  });

  const reload = useCallback(async () => {
    const [list, dash, myCrew] = await Promise.all([
      fieldService.listJournals(),
      fieldService.getDashboard(),
      fieldService.getCrew(),
    ]);
    setJournals(list);
    setProjects(dash.projects);
    setCrew(myCrew.filter((c) => c.status === "active"));
  }, []);

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => setLoading(false));
  }, [reload]);

  function openCreate() {
    const first = projects[0];
    setForm({
      date: new Date().toISOString().slice(0, 10),
      projectId: first?.id || "",
      clientName: first?.contractor || "",
      address: first?.location || "",
      workArea: "",
      actionsPerformed: "",
      notes: "",
      equipment: [],
      selectedWorkers: [],
    });
    setCreateOpen(true);
  }

  function onProjectChange(projectId: string) {
    const p = projects.find((x) => x.id === projectId);
    setForm((f) => ({
      ...f,
      projectId,
      clientName: p?.contractor || "",
      address: p?.location || "",
    }));
  }

  function toggleWorker(id: string) {
    setForm((f) => ({
      ...f,
      selectedWorkers: f.selectedWorkers.includes(id)
        ? f.selectedWorkers.filter((x) => x !== id)
        : [...f.selectedWorkers, id],
    }));
  }

  function toggleEquipment(item: string) {
    setForm((f) => ({
      ...f,
      equipment: f.equipment.includes(item)
        ? f.equipment.filter((x) => x !== item)
        : [...f.equipment, item],
    }));
  }

  async function createJournal(status: "draft" | "in_progress") {
    if (!form.projectId) {
      toast.error("יש לבחור פרויקט");
      return;
    }
    setSaving(true);
    try {
      await fieldService.createJournal({
        projectId: form.projectId,
        date: form.date,
        clientName: form.clientName,
        address: form.address,
        workArea: form.workArea,
        actionsPerformed: form.actionsPerformed,
        notes: form.notes,
        equipment: form.equipment.join(", "),
        status,
        workers: form.selectedWorkers.map((crewMemberId) => ({
          crewMemberId,
          startTime: "07:00",
          endTime: "16:00",
          status: "present",
        })),
      });
      setCreateOpen(false);
      await reload();
      toast.success(
        status === "in_progress"
          ? "יום העבודה התחיל — הסידור ברשימה"
          : "הסידור נשמר כטיוטה"
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "שמירת הסידור נכשלה",
        "נסה שוב בעוד מספר רגעים."
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedCrew = useMemo(
    () => crew.filter((c) => form.selectedWorkers.includes(c.id)),
    [crew, form.selectedWorkers]
  );

  if (error) {
    return (
      <div className="rounded-xl bg-white border border-red-100 p-5 text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            יומני עבודה
          </h1>
          <p className="text-base text-gray-500 mt-1">
            ניהול יומני העבודה היומיים שלך
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="h-14 px-5 rounded-2xl bg-[#1e40af] hover:bg-[#1e3a8a] text-white text-base font-bold inline-flex items-center gap-2 transition-colors"
        >
          <Plus className="h-5 w-5" />
          סידור עבודה חדש
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-16 text-lg">טוען...</p>
      ) : journals.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
          {journals.map((j) => (
            <JournalCard
              key={j.id}
              journal={j}
              onClick={() => router.push(`/field/journal/${j.id}`)}
            />
          ))}
        </div>
      )}

      <CreateScheduleDrawer
        open={createOpen}
        onClose={() => !saving && setCreateOpen(false)}
        form={form}
        setForm={setForm}
        projects={projects}
        crew={crew}
        selectedCrew={selectedCrew}
        saving={saving}
        onProjectChange={onProjectChange}
        toggleWorker={toggleWorker}
        toggleEquipment={toggleEquipment}
        onDraft={() => createJournal("draft")}
        onStart={() => createJournal("in_progress")}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 px-6 py-14 text-center">
      <div className="mx-auto h-[72px] w-[72px] rounded-full bg-[#dbeafe] flex items-center justify-center mb-5">
        <ClipboardList className="h-8 w-8 text-[#1e40af]" />
      </div>
      <h2 className="text-xl font-bold text-gray-900">
        עדיין לא נפתח יומן עבודה
      </h2>
      <p className="text-base text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
        פתח את יומן העבודה הראשון שלך והתחל לתעד את יום העבודה.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-6 h-14 px-6 rounded-2xl bg-[#1e40af] text-white text-base font-bold inline-flex items-center gap-2"
      >
        <Plus className="h-5 w-5" />
        סידור עבודה חדש
      </button>
    </div>
  );
}

function JournalCard({
  journal,
  onClick,
}: {
  journal: WorkJournal;
  onClick: () => void;
}) {
  const starts = journal.workers
    .map((w) => w.startTime)
    .filter(Boolean)
    .sort();
  const ends = journal.workers
    .map((w) => w.endTime)
    .filter(Boolean)
    .sort();
  const startTime = starts[0] || "—";
  const endTime = ends[ends.length - 1] || "—";
  const progress = estimateProgress(journal);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-right rounded-2xl bg-white border border-gray-200 p-4 lg:p-5 hover:border-[#93c5fd] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-bold text-gray-900 truncate">
            {journal.projectName}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatDate(journal.date)}
          </p>
        </div>
        <StatusBadge status={journal.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-600">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-gray-400" />
          {journal.workers.length} עובדים
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-gray-400" />
          {startTime}–{endTime}
        </div>
      </div>

      {progress != null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>התקדמות</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#1e40af]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: WorkJournal["status"] }) {
  if (status === "draft") {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">
        🟡 טיוטה
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 whitespace-nowrap">
        🟢 בביצוע
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
      נשלח
    </span>
  );
}

function estimateProgress(j: WorkJournal): number | null {
  if (j.status === "submitted") return 100;
  let score = 0;
  const total = 5;
  if (j.projectId) score++;
  if (j.workers.length > 0) score++;
  if (j.actionsPerformed?.trim()) score++;
  if (j.media.length > 0) score++;
  if (j.workArea?.trim() || j.notes?.trim()) score++;
  if (score === 0 && j.status === "draft") return null;
  return Math.round((score / total) * 100);
}

function CreateScheduleDrawer({
  open,
  onClose,
  form,
  setForm,
  projects,
  crew,
  selectedCrew,
  saving,
  onProjectChange,
  toggleWorker,
  toggleEquipment,
  onDraft,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  projects: { id: string; name: string; location: string; contractor: string }[];
  crew: FieldCrewMember[];
  selectedCrew: FieldCrewMember[];
  saving: boolean;
  onProjectChange: (id: string) => void;
  toggleWorker: (id: string) => void;
  toggleEquipment: (item: string) => void;
  onDraft: () => void;
  onStart: () => void;
}) {
  const [pickWorkers, setPickWorkers] = useState(false);

  useEffect(() => {
    if (!open) setPickWorkers(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/45"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative z-10 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col"
            dir="rtl"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-[#1e3a8a]">
                  סידור עבודה חדש
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  מלא פרטים והתחל תוך דקה
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="h-10 w-10 rounded-xl hover:bg-gray-100 inline-flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <section className="space-y-3">
                <h3 className="text-base font-bold">פרטי עבודה</h3>
                <label className="block text-sm text-gray-500">
                  תאריך
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block text-sm text-gray-500">
                  פרויקט
                  <select
                    value={form.projectId}
                    onChange={(e) => onProjectChange(e.target.value)}
                    className={`${inputClass} mt-1`}
                  >
                    {projects.length === 0 && (
                      <option value="">אין פרויקטים</option>
                    )}
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-gray-500">
                  לקוח
                  <input
                    value={form.clientName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, clientName: e.target.value }))
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block text-sm text-gray-500">
                  כתובת
                  <input
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block text-sm text-gray-500">
                  אזור עבודה
                  <input
                    value={form.workArea}
                    placeholder="קומה / אזור"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, workArea: e.target.value }))
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold">עובדים</h3>
                  <button
                    type="button"
                    onClick={() => setPickWorkers((v) => !v)}
                    className="h-10 px-3 rounded-xl border-2 border-[#1e40af] text-[#1e40af] text-sm font-bold inline-flex items-center gap-1 shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    הוסף עובד לסידור
                  </button>
                </div>

                {pickWorkers && (
                  <div className="rounded-xl border border-gray-200 p-3 space-y-2 bg-[#fafbfc] max-h-48 overflow-y-auto">
                    {crew.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 text-base py-1.5"
                      >
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={form.selectedWorkers.includes(c.id)}
                          onChange={() => toggleWorker(c.id)}
                        />
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-sm text-gray-400">
                          {c.profession}
                        </span>
                      </label>
                    ))}
                    {crew.length === 0 && (
                      <p className="text-sm text-gray-400">
                        אין עובדים ברשימה — הוסף ב«עובדים שלי»
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {selectedCrew.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm"
                    >
                      <p className="font-semibold text-[#1e3a8a]">{c.name}</p>
                      <p className="text-xs text-[#1e40af]">
                        {c.profession || "עובד"}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold">פעולות מתוכננות</h3>
                <textarea
                  value={form.actionsPerformed}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      actionsPerformed: e.target.value,
                    }))
                  }
                  className={`${inputClass} min-h-28`}
                  placeholder={"התקנת לוח חשמל\nהשחלת כבלים\nבדיקות"}
                />
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold">
                  ציוד דרוש{" "}
                  <span className="text-gray-400 font-normal">(אופציונלי)</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_OPTIONS.map((item) => {
                    const on = form.equipment.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleEquipment(item)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-sm border transition-colors",
                          on
                            ? "bg-[#1e40af] text-white border-[#1e40af]"
                            : "bg-white text-gray-700 border-gray-300"
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold">הערות</h3>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className={`${inputClass} min-h-24`}
                  placeholder="הערות ליום העבודה..."
                />
              </section>
            </div>

            <div className="border-t border-gray-100 p-4 space-y-2 bg-white">
              <button
                type="button"
                disabled={saving}
                onClick={onStart}
                className="w-full h-14 rounded-2xl bg-[#1e40af] hover:bg-[#1e3a8a] text-white text-base font-bold disabled:opacity-50 transition-colors"
              >
                {saving ? "שומר..." : "▶ התחל יום עבודה"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={onClose}
                  className="h-12 rounded-xl border border-gray-300 bg-white font-semibold disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onDraft}
                  className="h-12 rounded-xl border-2 border-[#1e40af] text-[#1e40af] font-bold disabled:opacity-50"
                >
                  שמור כטיוטה
                </button>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
