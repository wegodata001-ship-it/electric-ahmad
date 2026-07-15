"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { fieldService } from "@/features/field/services/field.service";
import { workManagementService } from "../services/work-management.service";
import type { WorkOrderVehicle, WorkOrderWorker } from "../types";
import "../styles/work-management.css";

type ProjectOpt = {
  id: string;
  name: string;
  location: string;
  contractor: string;
};

type CrewOpt = { id: string; name: string; profession?: string | null };

function hoursBetween(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

type EmpRow = WorkOrderWorker & { key: string };
type VehRow = WorkOrderVehicle & { key: string };

function emptyEmp(): EmpRow {
  return {
    key: nextKey(),
    crewMemberId: "",
    name: "",
    role: "",
    startTime: "07:00",
    endTime: "16:00",
    hours: 9,
    notes: "",
  };
}

function emptyVeh(): VehRow {
  return {
    key: nextKey(),
    name: "",
    plate: "",
    driverName: "",
    startTime: "07:00",
    endTime: "16:00",
    hours: 9,
    notes: "",
  };
}

export function WmBuildPage({ orderId }: { orderId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(orderId);

  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [crew, setCrew] = useState<CrewOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [workArea, setWorkArea] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [emps, setEmps] = useState<EmpRow[]>([emptyEmp()]);
  const [vehs, setVehs] = useState<VehRow[]>([emptyVeh()]);

  useEffect(() => {
    Promise.all([fieldService.getDashboard(), fieldService.getCrew()])
      .then(([dash, crewList]) => {
        setProjects(dash.projects);
        setCrew(
          crewList.map((c) => ({
            id: c.id,
            name: c.name,
            profession: c.profession,
          }))
        );
        if (dash.projects.length === 1) {
          const p = dash.projects[0]!;
          setProjectId(p.id);
          setClientName(p.contractor);
          setAddress(p.location);
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => {
        if (!orderId) setLoading(false);
      });
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    workManagementService
      .getById(orderId)
      .then((order) => {
        setProjectId(order.projectId);
        setDate(order.date);
        setTitle(order.title || "");
        setWorkArea(order.workArea || "");
        setClientName(order.clientName || "");
        setAddress(order.address || "");
        setNotes(order.notes || "");
        setEmps(
          order.workers.length
            ? order.workers.map((w) => ({ ...w, key: nextKey() }))
            : [emptyEmp()]
        );
        setVehs(
          order.vehicles.length
            ? order.vehicles.map((v) => ({ ...v, key: nextKey() }))
            : [emptyVeh()]
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      )
      .finally(() => setLoading(false));
  }, [orderId]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  function onProjectChange(id: string) {
    setProjectId(id);
    const p = projects.find((x) => x.id === id);
    if (p) {
      setClientName(p.contractor);
      setAddress(p.location);
      if (!title) setTitle(p.name);
    }
  }

  function updateEmp(key: string, patch: Partial<EmpRow>) {
    setEmps((rows) =>
      rows.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.crewMemberId !== undefined) {
          const c = crew.find((x) => x.id === patch.crewMemberId);
          if (c) {
            next.name = c.name;
            next.role = c.profession || next.role;
          }
        }
        if (patch.startTime !== undefined || patch.endTime !== undefined) {
          next.hours = hoursBetween(next.startTime || "", next.endTime || "");
        }
        return next;
      })
    );
  }

  function updateVeh(key: string, patch: Partial<VehRow>) {
    setVehs((rows) =>
      rows.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.startTime !== undefined || patch.endTime !== undefined) {
          next.hours = hoursBetween(next.startTime || "", next.endTime || "");
        }
        return next;
      })
    );
  }

  async function handleSave() {
    if (!projectId) {
      setError("יש לבחור פרויקט");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        projectId,
        date,
        title: title || selectedProject?.name || "",
        workArea,
        clientName,
        address,
        notes,
        workers: emps
          .filter((e) => e.name.trim() || e.crewMemberId)
          .map(({ key: _k, ...w }) => ({
            ...w,
            crewMemberId: w.crewMemberId || null,
          })),
        vehicles: vehs
          .filter((v) => v.name.trim())
          .map(({ key: _k, ...v }) => v),
      };

      const saved = isEdit
        ? await workManagementService.update(orderId!, payload)
        : await workManagementService.create(payload);

      router.push(`/field/journal/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-center text-gray-400 py-16">טוען...</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/field/journal"
          className="inline-flex items-center gap-1 text-sm text-gray-500 mb-2"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה ליומן
        </Link>
        <h1 className="text-2xl font-bold text-[#03142F]">
          {isEdit ? "עריכת סידור עבודה" : "סידור עבודה חדש"}
        </h1>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <section className="wm-panel">
        <h2 className="wm-panel-title">פרטי עבודה</h2>
        <div className="wm-form-grid">
          <div className="wm-field">
            <label>תאריך *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="wm-field">
            <label>כותרת</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="לדוגמה: חיווט קומה 3"
            />
          </div>
          <div className="wm-field">
            <label>פרויקט *</label>
            <select
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
            >
              <option value="">בחרו פרויקט</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="wm-field">
            <label>לקוח / קבלן</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div className="wm-field">
            <label>כתובת / אתר</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="wm-field">
            <label>אזור עבודה</label>
            <input
              value={workArea}
              onChange={(e) => setWorkArea(e.target.value)}
              placeholder="קומה / אגף / אזור"
            />
          </div>
          <div className="wm-field" style={{ gridColumn: "1 / -1" }}>
            <label>הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="wm-panel">
        <h2 className="wm-panel-title">עובדים</h2>
        <div className="overflow-x-auto">
          <table className="wm-line-table">
            <thead>
              <tr>
                <th>עובד</th>
                <th>תפקיד</th>
                <th>התחלה</th>
                <th>סיום</th>
                <th>שעות</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {emps.map((row) => (
                <tr key={row.key}>
                  <td>
                    <select
                      value={row.crewMemberId || ""}
                      onChange={(e) =>
                        updateEmp(row.key, { crewMemberId: e.target.value })
                      }
                    >
                      <option value="">בחרו עובד</option>
                      {crew.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      value={row.role || ""}
                      onChange={(e) =>
                        updateEmp(row.key, { role: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={row.startTime || ""}
                      onChange={(e) =>
                        updateEmp(row.key, { startTime: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={row.endTime || ""}
                      onChange={(e) =>
                        updateEmp(row.key, { endTime: e.target.value })
                      }
                    />
                  </td>
                  <td>{row.hours ?? 0}</td>
                  <td>
                    <button
                      type="button"
                      className="wm-btn wm-btn-ghost"
                      onClick={() =>
                        setEmps((rows) => rows.filter((r) => r.key !== row.key))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="wm-line-actions">
          <button
            type="button"
            className="wm-btn wm-btn-secondary"
            onClick={() => setEmps((rows) => [...rows, emptyEmp()])}
          >
            <Plus className="h-4 w-4" />
            הוסף עובד
          </button>
        </div>
      </section>

      <section className="wm-panel">
        <h2 className="wm-panel-title">רכבים / ציוד</h2>
        <div className="overflow-x-auto">
          <table className="wm-line-table">
            <thead>
              <tr>
                <th>שם / סוג</th>
                <th>מספר רכב</th>
                <th>נהג</th>
                <th>התחלה</th>
                <th>סיום</th>
                <th>שעות</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vehs.map((row) => (
                <tr key={row.key}>
                  <td>
                    <input
                      value={row.name}
                      onChange={(e) =>
                        updateVeh(row.key, { name: e.target.value })
                      }
                      placeholder="משאית / מנוף"
                    />
                  </td>
                  <td>
                    <input
                      value={row.plate || ""}
                      onChange={(e) =>
                        updateVeh(row.key, { plate: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={row.driverName || ""}
                      onChange={(e) =>
                        updateVeh(row.key, { driverName: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={row.startTime || ""}
                      onChange={(e) =>
                        updateVeh(row.key, { startTime: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={row.endTime || ""}
                      onChange={(e) =>
                        updateVeh(row.key, { endTime: e.target.value })
                      }
                    />
                  </td>
                  <td>{row.hours ?? 0}</td>
                  <td>
                    <button
                      type="button"
                      className="wm-btn wm-btn-ghost"
                      onClick={() =>
                        setVehs((rows) => rows.filter((r) => r.key !== row.key))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="wm-line-actions">
          <button
            type="button"
            className="wm-btn wm-btn-secondary"
            onClick={() => setVehs((rows) => [...rows, emptyVeh()])}
          >
            <Plus className="h-4 w-4" />
            הוסף רכב
          </button>
        </div>
      </section>

      <div className="flex gap-2 flex-wrap sticky bottom-4">
        <button
          type="button"
          className="wm-btn wm-btn-gold"
          disabled={saving}
          onClick={handleSave}
        >
          <Save className="h-4 w-4" />
          {saving ? "שומר..." : "שמור סידור"}
        </button>
        <Link href="/field/journal" className="wm-btn wm-btn-ghost">
          ביטול
        </Link>
      </div>
    </div>
  );
}
