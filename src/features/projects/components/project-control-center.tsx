"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GitBranch, Plus, Search, Settings2, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui";
import { PROJECT_STATUS_LABELS } from "@/constants";
import { BrandLogo } from "@/components/brand/brand-logo";
import { HubCreateDiaryModal } from "./hub-create-diary-modal";
import { HubCreateDnModal } from "./hub-create-dn-modal";
import { collectExpandableKeys, HubOrgTree } from "./hub-org-tree";
import type {
  HubCompany,
  HubFilterOptions,
  HubProject,
  HubRegion,
  HubSite,
  HubTreePayload,
  SelectedHubNode,
} from "./hub-tree-types";

function nodeKey(node: SelectedHubNode) {
  if (node.kind === "company") return "company:root";
  if (node.kind === "region") return `region:${node.region.id}`;
  if (node.kind === "project") return `project:${node.project.id}`;
  if (node.kind === "site") return `site:${node.site.id}`;
  return `contractor:${node.contractor.id}`;
}

export function ProjectControlCenter({
  accountsPath,
}: {
  accountsPath: string;
}) {
  const subcontractorsHref = accountsPath.replace(/\/accounts$/, "/subcontractors");
  const [company, setCompany] = useState<HubCompany | null>(null);
  const [regions, setRegions] = useState<HubRegion[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [filterOptions, setFilterOptions] = useState<HubFilterOptions>({
    regions: [],
    clients: [],
    projects: [],
  });
  const [totals, setTotals] = useState({ regions: 0, projects: 0, sites: 0, contractors: 0 });
  const [emptyReason, setEmptyReason] = useState<HubTreePayload["emptyReason"]>(null);
  const [canManageRegions, setCanManageRegions] = useState(false);
  const [canAssignManager, setCanAssignManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [regionId, setRegionId] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "company:root": true,
  });
  const [selected, setSelected] = useState<SelectedHubNode | null>(null);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [dnOpen, setDnOpen] = useState(false);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const [focusProjectId, setFocusProjectId] = useState<string | undefined>();
  const [focusSiteId, setFocusSiteId] = useState<string | undefined>();
  const [newSite, setNewSite] = useState({ name: "", address: "", contactName: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (regionId) params.set("regionId", regionId);
      if (clientId) params.set("clientId", clientId);
      if (projectId) params.set("projectId", projectId);
      if (status) params.set("status", status);
      const data = await apiClient.get<HubTreePayload>(
        `/api/projects/control-hub?${params.toString()}`
      );
      setCompany(data.company);
      setRegions(data.regions);
      setClients(data.clients);
      if (data.filterOptions) setFilterOptions(data.filterOptions);
      setTotals(data.totals);
      setEmptyReason(data.emptyReason ?? null);
      setCanManageRegions(data.canManageRegions);
      setCanAssignManager(data.canAssignManager);
      setExpanded((prev) => {
        const next: Record<string, boolean> = { ...prev, "company:root": true };
        for (const region of data.regions) {
          if (region.projects.length && prev[`region:${region.id}`] === undefined) {
            next[`region:${region.id}`] = true;
          }
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (regionId) params.set("regionId", regionId);
    if (clientId) params.set("clientId", clientId);
    if (projectId) params.set("projectId", projectId);
    if (status) params.set("status", status);
    apiClient
      .get<HubTreePayload>(`/api/projects/control-hub?${params.toString()}`)
      .then((data) => {
        if (!live) return;
        setCompany(data.company);
        setRegions(data.regions);
        setClients(data.clients);
        if (data.filterOptions) setFilterOptions(data.filterOptions);
        setTotals(data.totals);
        setEmptyReason(data.emptyReason ?? null);
        setCanManageRegions(data.canManageRegions);
        setCanAssignManager(data.canAssignManager);
        setExpanded((prev) => {
          const next: Record<string, boolean> = { ...prev, "company:root": true };
          for (const region of data.regions) {
            if (region.projects.length && prev[`region:${region.id}`] === undefined) {
              next[`region:${region.id}`] = true;
            }
          }
          return next;
        });
        setError("");
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "שגיאה בטעינה");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId, clientId, projectId, status]);

  const allProjects = regions.flatMap((r) => r.projects);
  const filterClients = useMemo(
    () =>
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        projects: allProjects
          .filter((p) => p.contractor.trim().toLowerCase() === c.name.trim().toLowerCase())
          .map((p) => ({
            id: p.id,
            name: p.name,
            contractor: p.contractor,
            location: p.location,
            sites: p.sites,
          })),
      })),
    [allProjects, clients]
  );

  function toggleNode(node: SelectedHubNode) {
    const key = nodeKey(node);
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openCreate(kind: "diary" | "dn", project?: HubProject, site?: HubSite) {
    setFocusProjectId(project?.id);
    setFocusSiteId(site?.id);
    if (kind === "diary") setDiaryOpen(true);
    else setDnOpen(true);
  }

  async function addSite(project: HubProject) {
    if (!newSite.name.trim()) return;
    await apiClient.post(`/api/projects/${project.id}/work-sites`, newSite);
    setNewSite({ name: "", address: "", contactName: "" });
    await load();
    setExpanded((prev) => ({ ...prev, [`project:${project.id}`]: true }));
  }

  const emptyMessage =
    emptyReason === "unauthorized"
      ? "אין פרויקטים משויכים למשתמש זה"
      : emptyReason === "filtered"
        ? "אין תוצאות לפי הסינון הנוכחי"
        : "אין פרויקטים להצגה";

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <BrandLogo height={40} maxWidth={160} className="mb-2" />
          <h1 className="text-2xl font-black text-[#111111]">מרכז ניהול פרויקטים</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageRegions && (
            <Button variant="secondary" onClick={() => setRegionsOpen(true)}>
              <Settings2 className="h-4 w-4" />
              אזורי עבודה
            </Button>
          )}
          <Link
            href={subcontractorsHref}
            className="inline-flex min-h-11 items-center rounded-xl border border-[#E6E8EB] bg-white px-4 text-sm font-bold"
          >
            ניהול קבלני משנה
          </Link>
          <Button onClick={() => openCreate("diary")}>+ הפקת יומן עבודה</Button>
          <Button variant="secondary" onClick={() => openCreate("dn")}>
            + הפקת תעודת משלוח
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="h-10 w-full rounded-lg border border-[#E6E8EB] bg-white py-2 pr-9 pl-20 text-sm"
            placeholder="חיפוש פרויקט, לקוח, סניף או קבלן"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
          />
          <button
            type="button"
            className="absolute left-1.5 top-1.5 rounded-md bg-[#C8102E] px-2.5 py-1 text-xs font-bold text-white"
            onClick={() => void load()}
          >
            חפש
          </button>
        </label>
        <select className="h-10 rounded-lg border border-[#E6E8EB] bg-white px-3 text-sm" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
          <option value="">כל האזורים</option>
          {(filterOptions.regions.length ? filterOptions.regions : regions).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select className="h-10 rounded-lg border border-[#E6E8EB] bg-white px-3 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">כל הלקוחות</option>
          {(filterOptions.clients.length ? filterOptions.clients : clients).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="h-10 rounded-lg border border-[#E6E8EB] bg-white px-3 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">כל הפרויקטים</option>
          {(filterOptions.projects.length ? filterOptions.projects : allProjects).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className="h-10 rounded-lg border border-[#E6E8EB] bg-white px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {Object.entries(PROJECT_STATUS_LABELS).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <button
          type="button"
          className="text-xs font-bold text-[#C8102E]"
          onClick={() =>
            setExpanded(Object.fromEntries(collectExpandableKeys(regions).map((k) => [k, true])))
          }
        >
          הרחב הכול
        </button>
        <button
          type="button"
          className="text-xs font-bold text-[#5B6470]"
          onClick={() => setExpanded({ "company:root": true })}
        >
          כווץ הכול
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">טוען נתונים אמיתיים…</p>}
      {!loading && !regions.length && (
        <div className="rounded-2xl border border-dashed border-[#E6E8EB] bg-white p-10 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}

      {!loading && company && regions.length > 0 && (
        <HubOrgTree
          company={company}
          regions={regions}
          expanded={expanded ?? { "company:root": true }}
          selectedId={selected ? nodeKey(selected) : null}
          onToggle={toggleNode}
          onDetails={setSelected}
          totals={{ regions: totals.regions, projects: totals.projects }}
        />
      )}

      {selected && (
        <DetailsDrawer
          selected={selected}
          regions={regions}
          accountsPath={accountsPath}
          subcontractorsHref={subcontractorsHref}
          canAssignManager={canAssignManager}
          newSite={newSite}
          setNewSite={setNewSite}
          onAddSite={(project) => void addSite(project)}
          onCreate={openCreate}
          onReload={() => void load()}
          onClose={() => setSelected(null)}
        />
      )}

      {regionsOpen && (
        <RegionsAdminModal onClose={() => setRegionsOpen(false)} onChanged={() => void load()} />
      )}

      {diaryOpen && (
        <HubCreateDiaryModal
          clients={filterClients}
          initialProjectId={focusProjectId}
          initialSiteId={focusSiteId}
          onClose={() => setDiaryOpen(false)}
          onCreated={() => {
            setDiaryOpen(false);
            void load();
          }}
        />
      )}
      {dnOpen && (
        <HubCreateDnModal
          clients={filterClients}
          initialProjectId={focusProjectId}
          initialSiteId={focusSiteId}
          onClose={() => setDnOpen(false)}
          onCreated={() => {
            setDnOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function DetailsDrawer({
  selected,
  regions,
  accountsPath,
  subcontractorsHref,
  canAssignManager,
  newSite,
  setNewSite,
  onAddSite,
  onCreate,
  onReload,
  onClose,
}: {
  selected: SelectedHubNode;
  regions: HubRegion[];
  accountsPath: string;
  subcontractorsHref: string;
  canAssignManager: boolean;
  newSite: { name: string; address: string; contactName: string };
  setNewSite: (v: { name: string; address: string; contactName: string }) => void;
  onAddSite: (project: HubProject) => void;
  onCreate: (kind: "diary" | "dn", project?: HubProject, site?: HubSite) => void;
  onReload: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/35" aria-label="סגור פרטים" onClick={onClose} />
      <aside className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl lg:inset-y-0 lg:bottom-auto lg:left-0 lg:right-auto lg:h-full lg:w-[380px] lg:rounded-none lg:border-r lg:border-[#E6E8EB]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-sm font-black">פרטי כרטיס</p>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border" onClick={onClose} aria-label="סגור">
            <X className="h-4 w-4" />
          </button>
        </div>
        {selected.kind === "company" && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-[#C8102E]">חברה</p>
            <h2 className="text-lg font-black">{selected.company.name}</h2>
            <p className="text-sm text-slate-500">{selected.company.tagline}</p>
          </div>
        )}
        {selected.kind === "region" && (
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-[#C8102E]">אזור עבודה</p>
            <h2 className="text-lg font-black">{selected.region.name}</h2>
            <p className="text-sm text-slate-500">
              {selected.region.projectCount} פרויקטים · {selected.region.siteCount} סניפים ·{" "}
              {selected.region.activeWorks} עבודות
            </p>
            <ul className="space-y-1 text-sm">
              {selected.region.projects.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </div>
        )}
        {selected.kind === "project" && (
          <ProjectDetails
            project={selected.project}
            regions={regions}
            accountsPath={accountsPath}
            canAssignManager={canAssignManager}
            newSite={newSite}
            setNewSite={setNewSite}
            onAddSite={onAddSite}
            onCreate={onCreate}
            onReload={onReload}
          />
        )}
        {selected.kind === "site" && (
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-[#C8102E]">סניף עבודה</p>
            <h2 className="text-lg font-black">{selected.site.name}</h2>
            <p className="text-sm text-slate-500">{selected.site.address || "ללא כתובת"}</p>
            <p className="text-sm text-slate-500">מנהל שטח: {selected.site.contactName || "לא הוגדר"}</p>
            {canAssignManager && (
              <label className="block text-xs font-bold">
                אזור סניף
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal"
                  defaultValue={selected.site.workRegionId ?? ""}
                  onChange={(e) => {
                    apiClient
                      .patch(`/api/projects/${selected.project.id}/work-sites/${selected.site.id}/work-region`, {
                        workRegionId: e.target.value || null,
                      })
                      .then(onReload)
                      .catch(() => undefined);
                  }}
                >
                  <option value="">כמו הפרויקט / ללא שיוך</option>
                  {regions.filter((r) => !r.unassigned).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
            )}
            <p className="text-xs text-slate-500">
              {selected.site.activeWorks} עבודות · {selected.site.diaryCount} יומנים · {selected.site.deliveryNoteCount} תעודות
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="min-h-11 rounded-xl bg-[#C8102E] px-3 text-xs font-bold text-white" onClick={() => onCreate("diary", selected.project, selected.site)}>
                יומן עבודה
              </button>
              <button type="button" className="min-h-11 rounded-xl border px-3 text-xs font-bold" onClick={() => onCreate("dn", selected.project, selected.site)}>
                תעודת משלוח
              </button>
              <Link href={`${accountsPath}?projectId=${selected.project.id}`} className="inline-flex min-h-11 items-center rounded-xl border px-3 text-xs font-bold">
                מסמכים / פרויקט
              </Link>
            </div>
            {selected.site.contractors.map((c) => (
              <p key={c.id} className="text-sm">{c.companyName} · {c.workStatusLabel}</p>
            ))}
          </div>
        )}
        {selected.kind === "contractor" && (
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-[#C8102E]">קבלן משנה</p>
            <h2 className="text-lg font-black">{selected.contractor.companyName}</h2>
            <p className="text-sm">{selected.contractor.description}</p>
            <Link href={`${subcontractorsHref}/${selected.contractor.subcontractorId}`} className="inline-flex min-h-11 items-center rounded-xl bg-[#C8102E] px-4 text-sm font-bold text-white">
              פתח כרטיס קבלן
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function ProjectDetails({
  project,
  regions,
  accountsPath,
  canAssignManager,
  newSite,
  setNewSite,
  onAddSite,
  onCreate,
  onReload,
}: {
  project: HubProject;
  regions: HubRegion[];
  accountsPath: string;
  canAssignManager: boolean;
  newSite: { name: string; address: string; contactName: string };
  setNewSite: (v: { name: string; address: string; contactName: string }) => void;
  onAddSite: (project: HubProject) => void;
  onCreate: (kind: "diary" | "dn", project?: HubProject, site?: HubSite) => void;
  onReload: () => void;
}) {
  const [managers, setManagers] = useState<Array<{ id: string; name: string }>>([]);
  const [ownerId, setOwnerId] = useState(project.ownerId ?? "");
  const [workRegionId, setWorkRegionId] = useState(project.workRegionId ?? "");

  useEffect(() => {
    if (!canAssignManager) return;
    let live = true;
    apiClient
      .get<{ items: Array<{ id: string; name: string }> }>("/api/project-managers")
      .then((r) => {
        if (live) setManagers(r.items);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [canAssignManager]);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold text-[#C8102E]">פרויקט</p>
      <h2 className="text-lg font-black">{project.name}</h2>
      <p className="text-sm text-slate-500">
        {project.contractNumber} · {project.contractor} · {project.ownerName || "ללא מנהל"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={`${accountsPath}?projectId=${project.id}`} className="inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-xs font-bold">
          <GitBranch className="h-3.5 w-3.5" />
          פתח פרויקט
        </Link>
        <button type="button" className="min-h-11 rounded-xl bg-[#C8102E] px-3 text-xs font-bold text-white" onClick={() => onCreate("diary", project)}>
          יומן עבודה
        </button>
        <button type="button" className="min-h-11 rounded-xl border px-3 text-xs font-bold" onClick={() => onCreate("dn", project)}>
          תעודת משלוח
        </button>
      </div>
      {canAssignManager && (
        <div className="grid gap-2 rounded-xl border p-3">
          <label className="text-xs font-bold">שיוך לאזור</label>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={workRegionId}
            onChange={(e) => {
              setWorkRegionId(e.target.value);
              apiClient
                .patch(`/api/projects/${project.id}/work-region`, { workRegionId: e.target.value || null })
                .then(onReload)
                .catch(() => undefined);
            }}
          >
            <option value="">ללא אזור משויך</option>
            {regions.filter((r) => !r.unassigned).map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <label className="text-xs font-bold">מנהל פרויקט</label>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={ownerId}
            onChange={(e) => {
              setOwnerId(e.target.value);
              apiClient
                .patch(`/api/projects/${project.id}`, { ownerId: e.target.value || null })
                .then(onReload)
                .catch(() => undefined);
            }}
          >
            <option value="">טרם הוקצה</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-2 rounded-xl border border-dashed p-3">
        <p className="text-xs font-bold">הוספת סניף עבודה</p>
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="שם סניף" value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} />
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="כתובת" value={newSite.address} onChange={(e) => setNewSite({ ...newSite, address: e.target.value })} />
        <div className="flex gap-2">
          <input className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="מנהל שטח" value={newSite.contactName} onChange={(e) => setNewSite({ ...newSite, contactName: e.target.value })} />
          <button type="button" className="rounded-lg bg-[#C8102E] px-3 text-white" onClick={() => onAddSite(project)}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function RegionsAdminModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Array<{ id: string; name: string; sortOrder: number; active: boolean }>>([]);
  const [name, setName] = useState("");

  function load() {
    apiClient
      .get<{ items: Array<{ id: string; name: string; sortOrder: number; active: boolean }> }>("/api/work-regions")
      .then((r) => setItems(r.items))
      .catch(() => undefined);
  }

  useEffect(() => {
    let live = true;
    apiClient
      .get<{ items: Array<{ id: string; name: string; sortOrder: number; active: boolean }> }>("/api/work-regions")
      .then((r) => {
        if (live) setItems(r.items);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/35" aria-label="סגור" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5">
        <h2 className="text-lg font-black">אזורי עבודה</h2>
        <p className="mt-1 text-sm text-[#5B6470]">הוספה, שינוי סדר והשבתה. פרויקטים קיימים לא משויכים אוטומטית.</p>
        <div className="mt-3 flex gap-2">
          <input className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" placeholder="שם אזור חדש" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            onClick={() =>
              apiClient.post("/api/work-regions", { name }).then(() => {
                setName("");
                load();
                onChanged();
              })
            }
          >
            הוסף
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-xl border px-3 py-2">
              <input
                className="min-w-0 flex-1 border-0 text-sm font-bold"
                defaultValue={item.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== item.name) {
                    apiClient.patch(`/api/work-regions/${item.id}`, { name: e.target.value }).then(() => {
                      load();
                      onChanged();
                    });
                  }
                }}
              />
              <button
                type="button"
                className="text-xs font-bold"
                onClick={() =>
                  apiClient.patch(`/api/work-regions/${item.id}`, { sortOrder: item.sortOrder - 1 }).then(() => {
                    load();
                    onChanged();
                  })
                }
              >
                למעלה
              </button>
              <button
                type="button"
                className="text-xs font-bold"
                onClick={() =>
                  apiClient.patch(`/api/work-regions/${item.id}`, { sortOrder: item.sortOrder + 1 }).then(() => {
                    load();
                    onChanged();
                  })
                }
              >
                למטה
              </button>
              <button
                type="button"
                className="text-xs font-bold text-red-700"
                onClick={() =>
                  apiClient.patch(`/api/work-regions/${item.id}`, { active: !item.active }).then(() => {
                    load();
                    onChanged();
                  })
                }
              >
                {item.active ? "השבת" : "הפעל"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
