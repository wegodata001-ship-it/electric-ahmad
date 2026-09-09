"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api/client";

type Manager = {
  id: string;
  name: string;
  username: string;
  status: string;
  projectIds: string[];
};

type Project = {
  id: string;
  name: string;
  contractNumber: string;
  status: string;
  ownerId: string;
  owner: { id: string; name: string; role: string };
};

export function ProjectManagerAssignmentsPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [managerId, setManagerId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load(preferredManagerId?: string) {
    const data = await apiClient.get<{
      managers: Manager[];
      projects: Project[];
    }>("/api/project-manager-assignments");
    setManagers(data.managers);
    setProjects(data.projects);
    const nextId =
      preferredManagerId || managerId || data.managers[0]?.id || "";
    setManagerId(nextId);
    setSelected(
      data.managers.find((manager) => manager.id === nextId)?.projectIds ?? []
    );
  }

  useEffect(() => {
    let active = true;
    apiClient
      .get<{ managers: Manager[]; projects: Project[] }>(
        "/api/project-manager-assignments"
      )
      .then((data) => {
        if (!active) return;
        setManagers(data.managers);
        setProjects(data.projects);
        const nextId = data.managers[0]?.id ?? "";
        setManagerId(nextId);
        setSelected(data.managers[0]?.projectIds ?? []);
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "שגיאה בטעינה");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const activeManager = useMemo(
    () => managers.find((manager) => manager.id === managerId),
    [managers, managerId]
  );

  function chooseManager(id: string) {
    setManagerId(id);
    setSelected(
      managers.find((manager) => manager.id === id)?.projectIds ?? []
    );
    setMessage("");
  }

  function toggleProject(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((projectId) => projectId !== id)
        : [...current, id]
    );
  }

  async function save() {
    if (!managerId) return;
    setSaving(true);
    setMessage("");
    try {
      await apiClient.put("/api/project-manager-assignments", {
        userId: managerId,
        projectIds: selected,
      });
      await load(managerId);
      setMessage("השיוכים נשמרו");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-black">שיוך מנהלי פרויקט</h1>
        <p className="mt-1 text-sm text-slate-500">
          הוספה והסרה של פרויקטים בלבד. ניהול תפקידים, סיסמאות וסטטוס משתמש
          נשאר בידי מנהל מערכת.
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-bold">מנהל פרויקט</span>
        <select
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
          value={managerId}
          onChange={(event) => chooseManager(event.target.value)}
        >
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name} · {manager.username}
              {manager.status !== "ACTIVE" ? " · לא פעיל" : ""}
            </option>
          ))}
        </select>
      </label>

      {!managers.length ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">
          לא נמצאו מנהלי פרויקט
        </p>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-black">
            פרויקטים משויכים ל{activeManager?.name ?? "מנהל"}
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {projects.map((project) => {
              const checked = selected.includes(project.id);
              const assignedElsewhere =
                project.owner.role === "PROJECT_MANAGER" &&
                project.ownerId !== managerId;
              return (
                <label
                  key={project.id}
                  className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProject(project.id)}
                  />
                  <span>
                    <span className="block font-bold">{project.name}</span>
                    <span className="text-xs text-slate-500">
                      {project.contractNumber} · {project.status}
                      {assignedElsewhere
                        ? ` · משויך כעת ל${project.owner.name}`
                        : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {message && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm">{message}</p>
      )}
      <button
        type="button"
        disabled={!managerId || saving}
        onClick={save}
        className="rounded-xl bg-slate-900 px-5 py-3 font-black text-white disabled:opacity-50"
      >
        {saving ? "שומר…" : "שמור שיוכים"}
      </button>
    </section>
  );
}
