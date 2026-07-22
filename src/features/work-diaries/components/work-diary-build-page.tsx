"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { fieldService } from "@/features/field/services/field.service";
import { workDiariesService } from "../services/work-diaries.service";

type ProjectOpt = {
  id: string;
  name: string;
  location: string;
  contractor: string;
};

type CrewOpt = { id: string; name: string; profession?: string | null };

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

function hoursBetween(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

type WorkRow = {
  key: string;
  description: string;
  unit: string;
  quantity: string;
  notes: string;
};

type EmpRow = {
  key: string;
  crewMemberId: string;
  name: string;
  role: string;
  startTime: string;
  endTime: string;
  hours: number;
};

type NamedRow = { key: string; name: string; quantity: string; unit: string; notes: string };

function emptyWork(): WorkRow {
  return { key: nextKey(), description: "", unit: "יח'", quantity: "", notes: "" };
}
function emptyEmp(): EmpRow {
  return {
    key: nextKey(),
    crewMemberId: "",
    name: "",
    role: "",
    startTime: "07:00",
    endTime: "16:00",
    hours: 9,
  };
}
function emptyNamed(): NamedRow {
  return { key: nextKey(), name: "", quantity: "", unit: "יח'", notes: "" };
}

export function WorkDiaryBuildPage({ diaryId }: { diaryId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(diaryId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [docNumber, setDocNumber] = useState("…");

  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [crew, setCrew] = useState<CrewOpt[]>([]);
  const [projectId, setProjectId] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [workTime, setWorkTime] = useState("");
  const [weather, setWeather] = useState("");
  const [workType, setWorkType] = useState("");
  const [workSummary, setWorkSummary] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [workItems, setWorkItems] = useState<WorkRow[]>([emptyWork()]);
  const [workers, setWorkers] = useState<EmpRow[]>([emptyEmp()]);
  const [equipment, setEquipment] = useState<NamedRow[]>([]);
  const [materials, setMaterials] = useState<NamedRow[]>([]);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  useEffect(() => {
    Promise.all([
      fieldService.getDashboard(),
      fieldService.getCrew(),
      workDiariesService.peekNumber(),
    ])
      .then(([dash, crewList, peek]) => {
        setProjects(dash.projects ?? []);
        setCrew(
          (crewList ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            profession: c.profession,
          }))
        );
        if (!isEdit) setDocNumber(peek.documentNumber);
      })
      .catch((e) => setError(e.message));
  }, [isEdit]);

  useEffect(() => {
    if (!diaryId) return;
    workDiariesService
      .get(diaryId)
      .then((d) => {
        setDocNumber(d.documentNumber);
        setProjectId(d.projectId);
        setWorkDate(d.workDate);
        setWorkTime(d.workTime ?? "");
        setWeather(d.weather ?? "");
        setWorkType(d.workType ?? "");
        setWorkSummary(d.workSummary ?? "");
        setClientName(d.clientName ?? "");
        setAddress(d.address ?? "");
        setNotes(d.notes ?? "");
        setWorkItems(
          d.workItems?.length
            ? d.workItems.map((i: any) => ({
                key: nextKey(),
                description: i.description,
                unit: i.unit,
                quantity: String(i.quantity ?? ""),
                notes: i.notes ?? "",
              }))
            : [emptyWork()]
        );
        setWorkers(
          d.workers?.length
            ? d.workers.map((w: any) => ({
                key: nextKey(),
                crewMemberId: w.crewMemberId ?? "",
                name: w.name,
                role: w.role ?? "",
                startTime: w.startTime ?? "",
                endTime: w.endTime ?? "",
                hours: w.hours ?? 0,
              }))
            : [emptyEmp()]
        );
        setEquipment(
          (d.equipment ?? []).map((e: any) => ({
            key: nextKey(),
            name: e.name,
            quantity: e.quantity != null ? String(e.quantity) : "",
            unit: "יח'",
            notes: e.notes ?? "",
          }))
        );
        setMaterials(
          (d.materials ?? []).map((m: any) => ({
            key: nextKey(),
            name: m.name,
            quantity: String(m.quantity ?? ""),
            unit: m.unit ?? "יח'",
            notes: m.notes ?? "",
          }))
        );
        setSignatureUrl(d.foremanSignatureUrl);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [diaryId]);

  useEffect(() => {
    if (!selectedProject || isEdit) return;
    if (!clientName) setClientName(selectedProject.contractor || "");
    if (!address) setAddress(selectedProject.location || "");
  }, [selectedProject, isEdit, clientName, address]);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#03142F";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endDraw() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) setSignatureUrl(canvas.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureUrl(null);
  }

  async function save() {
    setError("");
    if (!projectId) {
      setError("יש לבחור פרויקט");
      return;
    }
    setSaving(true);
    try {
      const body = {
        projectId,
        workDate,
        workTime: workTime || null,
        weather: weather || null,
        workType: workType || null,
        workSummary: workSummary || null,
        clientName: clientName || null,
        address: address || null,
        notes: notes || null,
        foremanSignatureUrl: signatureUrl,
        workItems: workItems
          .filter((i) => i.description.trim())
          .map((i) => ({
            description: i.description.trim(),
            unit: i.unit || "יח'",
            quantity: Number(i.quantity) || 0,
            notes: i.notes || null,
          })),
        workers: workers
          .filter((w) => w.name.trim())
          .map((w) => ({
            crewMemberId: w.crewMemberId || null,
            name: w.name.trim(),
            role: w.role || null,
            startTime: w.startTime || null,
            endTime: w.endTime || null,
            hours: w.hours || hoursBetween(w.startTime, w.endTime),
          })),
        equipment: equipment
          .filter((e) => e.name.trim())
          .map((e) => ({
            name: e.name.trim(),
            quantity: e.quantity ? Number(e.quantity) : null,
            notes: e.notes || null,
          })),
        materials: materials
          .filter((m) => m.name.trim())
          .map((m) => ({
            name: m.name.trim(),
            unit: m.unit || "יח'",
            quantity: Number(m.quantity) || 0,
            notes: m.notes || null,
          })),
      };

      const saved = isEdit
        ? await workDiariesService.update(diaryId!, body)
        : await workDiariesService.create(body);

      router.replace(`/field/work-diaries/${saved.id}`);
    } catch (e: any) {
      setError(e.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">טוען…</p>;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Link href="/field/work-diaries" className="text-gray-500 hover:text-gray-800">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#03142F]">
            {isEdit ? "עריכת יומן עבודה" : "יומן עבודה חדש"}
          </h1>
          <p className="text-sm text-gray-500">מספר יומן: {docNumber}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      <section className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
        <h2 className="font-bold text-[#03142F]">פרטי המסמך</h2>
        <label className="block text-sm">
          <span className="text-gray-500">פרויקט</span>
          <select
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">בחר פרויקט</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-gray-500">תאריך</span>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-500">שעה</span>
            <input
              type="time"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5"
              value={workTime}
              onChange={(e) => setWorkTime(e.target.value)}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-gray-500">מזג אוויר</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5"
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              placeholder="בהיר / גשום…"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-500">סוג העבודה</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5"
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-gray-500">לקוח</span>
          <input
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-500">כתובת</span>
          <input
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-500">פירוט העבודה</span>
          <textarea
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 min-h-24"
            value={workSummary}
            onChange={(e) => setWorkSummary(e.target.value)}
          />
        </label>
      </section>

      <section className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#03142F]">פירוט עבודה</h2>
          <button
            type="button"
            onClick={() => setWorkItems((r) => [...r, emptyWork()])}
            className="text-sm text-[#1e40af] font-semibold inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> שורה
          </button>
        </div>
        {workItems.map((row, idx) => (
          <div key={row.key} className="space-y-2 border-t border-gray-100 pt-3">
            <div className="flex justify-between text-xs text-gray-400">
              <span>סעיף {idx + 1}</span>
              <button type="button" onClick={() => setWorkItems((r) => r.filter((x) => x.key !== row.key))}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </button>
            </div>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="תיאור העבודה"
              value={row.description}
              onChange={(e) =>
                setWorkItems((r) =>
                  r.map((x) => (x.key === row.key ? { ...x, description: e.target.value } : x))
                )
              }
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="יחידה"
                value={row.unit}
                onChange={(e) =>
                  setWorkItems((r) =>
                    r.map((x) => (x.key === row.key ? { ...x, unit: e.target.value } : x))
                  )
                }
              />
              <input
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="כמות"
                inputMode="decimal"
                value={row.quantity}
                onChange={(e) =>
                  setWorkItems((r) =>
                    r.map((x) => (x.key === row.key ? { ...x, quantity: e.target.value } : x))
                  )
                }
              />
              <input
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="הערות"
                value={row.notes}
                onChange={(e) =>
                  setWorkItems((r) =>
                    r.map((x) => (x.key === row.key ? { ...x, notes: e.target.value } : x))
                  )
                }
              />
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#03142F]">עובדים</h2>
          <button
            type="button"
            onClick={() => setWorkers((r) => [...r, emptyEmp()])}
            className="text-sm text-[#1e40af] font-semibold inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> עובד
          </button>
        </div>
        {workers.map((row) => (
          <div key={row.key} className="space-y-2 border-t border-gray-100 pt-3">
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={row.crewMemberId}
                onChange={(e) => {
                  const c = crew.find((x) => x.id === e.target.value);
                  setWorkers((r) =>
                    r.map((x) =>
                      x.key === row.key
                        ? {
                            ...x,
                            crewMemberId: e.target.value,
                            name: c?.name ?? x.name,
                            role: c?.profession ?? x.role,
                          }
                        : x
                    )
                  );
                }}
              >
                <option value="">בחר מרשימה / הזן ידנית</option>
                {crew.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setWorkers((r) => r.filter((x) => x.key !== row.key))}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </button>
            </div>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="שם עובד"
              value={row.name}
              onChange={(e) =>
                setWorkers((r) =>
                  r.map((x) => (x.key === row.key ? { ...x, name: e.target.value } : x))
                )
              }
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="תפקיד"
                value={row.role}
                onChange={(e) =>
                  setWorkers((r) =>
                    r.map((x) => (x.key === row.key ? { ...x, role: e.target.value } : x))
                  )
                }
              />
              <input
                type="time"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={row.startTime}
                onChange={(e) =>
                  setWorkers((r) =>
                    r.map((x) =>
                      x.key === row.key
                        ? {
                            ...x,
                            startTime: e.target.value,
                            hours: hoursBetween(e.target.value, x.endTime),
                          }
                        : x
                    )
                  )
                }
              />
              <input
                type="time"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                value={row.endTime}
                onChange={(e) =>
                  setWorkers((r) =>
                    r.map((x) =>
                      x.key === row.key
                        ? {
                            ...x,
                            endTime: e.target.value,
                            hours: hoursBetween(x.startTime, e.target.value),
                          }
                        : x
                    )
                  )
                }
              />
            </div>
            <p className="text-xs text-gray-400">סך שעות: {row.hours}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#03142F]">ציוד</h2>
          <button
            type="button"
            onClick={() => setEquipment((r) => [...r, emptyNamed()])}
            className="text-sm text-[#1e40af] font-semibold inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> פריט
          </button>
        </div>
        {equipment.map((row) => (
          <div key={row.key} className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="שם ציוד"
              value={row.name}
              onChange={(e) =>
                setEquipment((r) =>
                  r.map((x) => (x.key === row.key ? { ...x, name: e.target.value } : x))
                )
              }
            />
            <input
              className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="כמות"
              value={row.quantity}
              onChange={(e) =>
                setEquipment((r) =>
                  r.map((x) => (x.key === row.key ? { ...x, quantity: e.target.value } : x))
                )
              }
            />
            <button type="button" onClick={() => setEquipment((r) => r.filter((x) => x.key !== row.key))}>
              <Trash2 className="h-4 w-4 text-red-400" />
            </button>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#03142F]">חומרים</h2>
          <button
            type="button"
            onClick={() => setMaterials((r) => [...r, emptyNamed()])}
            className="text-sm text-[#1e40af] font-semibold inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> פריט
          </button>
        </div>
        {materials.map((row) => (
          <div key={row.key} className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="שם חומר"
              value={row.name}
              onChange={(e) =>
                setMaterials((r) =>
                  r.map((x) => (x.key === row.key ? { ...x, name: e.target.value } : x))
                )
              }
            />
            <input
              className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="יח'"
              value={row.unit}
              onChange={(e) =>
                setMaterials((r) =>
                  r.map((x) => (x.key === row.key ? { ...x, unit: e.target.value } : x))
                )
              }
            />
            <input
              className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              placeholder="כמות"
              value={row.quantity}
              onChange={(e) =>
                setMaterials((r) =>
                  r.map((x) => (x.key === row.key ? { ...x, quantity: e.target.value } : x))
                )
              }
            />
            <button type="button" onClick={() => setMaterials((r) => r.filter((x) => x.key !== row.key))}>
              <Trash2 className="h-4 w-4 text-red-400" />
            </button>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
        <h2 className="font-bold text-[#03142F]">הערות</h2>
        <textarea
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 min-h-28"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>

      <section className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#03142F]">חתימת מנהל עבודה</h2>
          <button type="button" onClick={clearSignature} className="text-xs text-gray-500">
            נקה
          </button>
        </div>
        {signatureUrl && !canvasRef.current && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signatureUrl} alt="חתימה" className="h-24 object-contain border rounded-xl" />
        )}
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full touch-none rounded-xl border border-dashed border-gray-300 bg-gray-50"
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
        />
      </section>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e40af] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {saving ? "שומר…" : "שמור יומן עבודה"}
      </button>
    </div>
  );
}
