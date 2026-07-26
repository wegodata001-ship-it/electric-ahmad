"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Download,
  ExternalLink,
  FileText,
  Folder,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  HUB_FOLDERS,
  TONE_CLASS,
  kindLabel,
  type StatusTone,
} from "@/lib/documents/hub-folders";
import type { HubListItem } from "@/repositories/documents-hub.repository";
import type { ListPageInfo } from "@/lib/api/list-query";
import { cn } from "@/lib/utils";
import { uploadService } from "@/features/documents/services/upload.service";
import { VirtualList } from "@/components/ui/virtual-list";

const PAGE_SIZE = 50;

type HubListResponse = {
  items: HubListItem[];
  pageInfo?: ListPageInfo;
  folderCounts?: Record<string, number>;
};

type TabId =
  | "overview"
  | "approvals"
  | "requests"
  | "revisions"
  | "versions"
  | "related"
  | "conversation"
  | "timeline";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "סקירה" },
  { id: "approvals", label: "אישורים" },
  { id: "requests", label: "בקשות" },
  { id: "revisions", label: "תיקונים" },
  { id: "versions", label: "גרסאות" },
  { id: "related", label: "מסמכים קשורים" },
  { id: "conversation", label: "Conversation" },
  { id: "timeline", label: "Timeline" },
];

export function DocumentsHubV2Page({
  projectId: fixedProjectId,
  embedded = false,
}: {
  projectId?: string;
  embedded?: boolean;
}) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState(fixedProjectId || "");
  const [items, setItems] = useState<HubListItem[]>([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [folderCounts, setFolderCounts] = useState<Record<string, number> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState<string>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [busy, setBusy] = useState(false);
  const [ensureAsk, setEnsureAsk] = useState<HubListItem | null>(null);
  const [convText, setConvText] = useState("");
  const [uploading, setUploading] = useState(false);

  // Latest values used inside async loaders / infinite-scroll callback.
  const latest = useRef({ projectId, folderId, query, skip, hasMore });
  latest.current = { projectId, folderId, query, skip, hasMore };

  const buildQs = useCallback(
    (pid: string, folder: string, q: string, nextSkip: number) => {
      const p = new URLSearchParams();
      if (pid) p.set("projectId", pid);
      if (q.trim()) p.set("q", q.trim());
      if (folder !== "all") p.set("folderId", folder);
      p.set("take", String(PAGE_SIZE));
      p.set("skip", String(nextSkip));
      return p.toString();
    },
    []
  );

  const fetchPage = useCallback(
    async (
      pid: string,
      folder: string,
      q: string,
      nextSkip: number,
      replace: boolean
    ) => {
      const qs = buildQs(pid, folder, q, nextSkip);
      const r = await apiClient.get<HubListResponse>(`/api/documents/hub?${qs}`);
      if (replace) {
        setItems(r.items);
      } else {
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.hubKey));
          const merged = r.items.filter((i) => !seen.has(i.hubKey));
          return merged.length ? [...prev, ...merged] : prev;
        });
      }
      setSkip(nextSkip + r.items.length);
      setHasMore(!!r.pageInfo?.hasMore);
      setFolderCounts(r.folderCounts ?? null);
    },
    [buildQs]
  );

  const reload = useCallback(
    async (pid = projectId) => {
      setLoading(true);
      setError("");
      try {
        await fetchPage(pid, folderId, query, 0, true);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [fetchPage, projectId, folderId, query]
  );

  const loadMore = useCallback(async () => {
    const { hasMore: hm, skip: sk, projectId: pid, folderId: fd, query: q } =
      latest.current;
    if (!hm || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(pid, fd, q, sk, false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loadingMore]);

  /**
   * Bootstrap on mount + when project/folder change: reset skip and load page 1.
   * The projects picker is fetched in parallel to avoid blocking the hub RTT.
   */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const pid = fixedProjectId || projectId;
        if (pid) {
          if (!fixedProjectId && projects.length === 0) {
            const [projRes] = await Promise.all([
              apiClient
                .get<
                  | { id: string; name: string }[]
                  | { items: { id: string; name: string }[] }
                >("/api/projects")
                .catch(() => [] as { id: string; name: string }[]),
              fetchPage(pid, folderId, query, 0, true),
            ]);
            if (cancelled) return;
            const list = Array.isArray(projRes)
              ? projRes
              : (projRes as { items?: { id: string; name: string }[] }).items ||
                [];
            setProjects(list);
          } else {
            await fetchPage(pid, folderId, query, 0, true);
          }
          return;
        }

        const [projRes] = await Promise.all([
          apiClient
            .get<
              | { id: string; name: string }[]
              | { items: { id: string; name: string }[] }
            >("/api/projects")
            .catch(() => [] as { id: string; name: string }[]),
          fetchPage("", folderId, query, 0, true),
        ]);
        if (cancelled) return;
        const list = Array.isArray(projRes)
          ? projRes
          : (projRes as { items?: { id: string; name: string }[] }).items || [];
        setProjects(list);
        if (list[0]?.id) setProjectId(list[0].id);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedProjectId, projectId, folderId]);

  async function openItem(item: HubListItem) {
    setSelectedKey(item.hubKey);
    setTab("overview");
    setDetailLoading(true);
    setError("");
    try {
      const d = await apiClient.get(
        `/api/documents/hub/${item.kind}/${item.entityId}`
      );
      setDetail(d);
    } catch (e: any) {
      setError(e.message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function ensureArchive(item: HubListItem) {
    setBusy(true);
    setError("");
    try {
      await apiClient.post("/api/documents/hub/ensure", {
        kind: item.kind,
        entityId: item.entityId,
      });
      setInfo("המסמך נשמר בארכיון המסמכים");
      setEnsureAsk(null);
      await reload();
      if (selectedKey === item.hubKey) await openItem(item);
    } catch (e: any) {
      setError(e.message || "שגיאה בשמירה לארכיון");
    } finally {
      setBusy(false);
    }
  }

  async function sendConversation() {
    if (!detail?.workflowDocumentId || !convText.trim()) return;
    setBusy(true);
    try {
      await fetch(
        `/api/workflow/documents/${detail.workflowDocumentId}/conversation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: convText.trim() }),
        }
      );
      setConvText("");
      const item = items.find((i) => i.hubKey === selectedKey);
      if (item) await openItem(item);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length || !projectId) {
      setError("בחרו פרויקט לפני העלאה");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith("image/");
        await uploadService.uploadFile({
          file,
          projectId,
          type: isImage ? "image" : "document",
          folderPath: isImage ? "תמונות" : "מסמכים כלליים",
        });
      }
      setInfo("הקובץ הועלה");
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: 0 };
    for (const f of HUB_FOLDERS) map[f.id] = 0;
    if (folderCounts) {
      let total = 0;
      for (const f of HUB_FOLDERS) {
        const n = folderCounts[f.id] || 0;
        map[f.id] = n;
        total += n;
      }
      map.all = total;
    } else {
      map.all = items.length;
      for (const i of items) map[i.folderId] = (map[i.folderId] || 0) + 1;
    }
    return map;
  }, [items, folderCounts]);

  // Server owns folderId + q filters. Items are already narrowed at fetch time.
  const visible = items;

  return (
    <div className={cn("space-y-4", !embedded && "p-4 sm:p-6")} dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900">מסמכים</h1>
          <p className="mt-1 text-sm text-stone-500">
            מרכז המסמכים של הפרויקט — קובץ, אישורים, תיקונים, גרסאות והיסטוריה
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!fixedProjectId && (
            <select
              className="min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">כל הפרויקטים</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white">
            {uploading ? "מעלה…" : "העלאת קובץ"}
            <input
              type="file"
              className="hidden"
              multiple
              disabled={uploading || !projectId}
              onChange={(e) => void onUpload(e.target.files)}
            />
          </label>
        </div>
      </div>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {info}
        </p>
      )}

      <div className="relative max-w-xl">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          className="w-full rounded-2xl border border-stone-200 py-2.5 pr-9 pl-3 text-sm"
          placeholder="חיפוש במסמכים…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void reload();
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FolderChip
          active={folderId === "all"}
          label="הכל"
          count={counts.all || 0}
          onClick={() => setFolderId("all")}
        />
        {HUB_FOLDERS.map((f) => (
          <FolderChip
            key={f.id}
            active={folderId === f.id}
            label={`${f.emoji} ${f.label}`}
            count={counts[f.id] || 0}
            onClick={() => setFolderId(f.id)}
          />
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-stone-400">טוען מרכז מסמכים…</p>
      ) : !visible.length ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-400">
          אין מסמכים בתיקייה זו
        </div>
      ) : (
        <VirtualList
          items={visible}
          getKey={(item) => item.hubKey}
          height="min(60vh, 560px)"
          estimateSize={76}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onEndReached={() => void loadMore()}
          renderItem={(item) => (
            <div className="pb-2">
              <article
                className={cn(
                  "rounded-2xl border bg-white p-4 transition",
                  selectedKey === item.hubKey
                    ? "border-amber-400 shadow-sm"
                    : "border-stone-200 hover:border-stone-300"
                )}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-600"
                  >
                    <FileText className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void openItem(item)}
                    className="min-w-0 flex-1 text-right"
                  >
                    <p className="text-xs font-bold text-amber-700">
                      {kindLabel(item.kind)}
                    </p>
                    <p className="truncate text-base font-black text-stone-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {item.projectName || "—"}
                      {item.creatorName ? ` · ${item.creatorName}` : ""}
                      {" · "}
                      {new Date(item.updatedAt).toLocaleString("he-IL")}
                    </p>
                  </button>
                  <StatusBadge
                    label={item.statusLabel}
                    tone={item.statusTone as StatusTone}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionChip
                    icon={ExternalLink}
                    label="פתח"
                    onClick={() => void openItem(item)}
                  />
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-stone-200 px-3 text-xs font-bold text-stone-700"
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </a>
                  )}
                  <ActionChip
                    icon={MessageSquare}
                    label="Conversation"
                    onClick={() => {
                      void openItem(item).then(() => setTab("conversation"));
                    }}
                  />
                  <ActionChip
                    icon={Clock}
                    label="Timeline"
                    onClick={() => {
                      void openItem(item).then(() => setTab("timeline"));
                    }}
                  />
                  {!item.inArchive && (
                    <ActionChip
                      icon={Plus}
                      label="הוסף למסמכים"
                      primary
                      onClick={() => setEnsureAsk(item)}
                    />
                  )}
                  {item.inArchive && (
                    <span className="inline-flex min-h-9 items-center rounded-xl bg-emerald-50 px-3 text-xs font-bold text-emerald-800">
                      בארכיון
                    </span>
                  )}
                </div>
              </article>
            </div>
          )}
        />
      )}

      {/* Detail drawer */}
      {(selectedKey || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/35">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 p-4">
              <div>
                <p className="text-xs font-bold text-amber-700">
                  {detail ? kindLabel(detail.kind) : "…"}
                </p>
                <h2 className="text-xl font-black">
                  {detail?.list?.title || "טוען מסמך…"}
                </h2>
                {detail?.list && (
                  <div className="mt-2">
                    <StatusBadge
                      label={detail.list.statusLabel}
                      tone={detail.list.statusTone}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedKey(null);
                  setDetail(null);
                }}
                className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-stone-100 px-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "shrink-0 px-3 py-2.5 text-xs font-bold",
                    tab === t.id
                      ? "border-b-2 border-amber-600 text-amber-800"
                      : "text-stone-500"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {detailLoading && (
                <p className="flex items-center gap-2 text-sm text-stone-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  טוען…
                </p>
              )}

              {!detailLoading && detail && tab === "overview" && (
                <div className="space-y-4">
                  <MetaGrid
                    rows={[
                      ["פרויקט", detail.list.projectName],
                      ["מספר", detail.list.documentNumber],
                      ["יוצר", detail.list.creatorName],
                      ["סטטוס", detail.list.statusLabel],
                      [
                        "בארכיון",
                        detail.list.inArchive ? "כן" : "לא — זמני בלבד",
                      ],
                    ]}
                  />
                  {detail.list.url && (
                    <a
                      href={detail.list.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-stone-900 font-bold text-white"
                    >
                      <ExternalLink className="h-4 w-4" />
                      פתח / הורד PDF
                    </a>
                  )}
                  {!detail.list.inArchive && (
                    <button
                      type="button"
                      onClick={() =>
                        setEnsureAsk({
                          hubKey: detail.list.hubKey,
                          kind: detail.kind,
                          entityId: detail.entityId,
                          inArchive: false,
                        } as HubListItem)
                      }
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 font-bold text-amber-900"
                    >
                      <Plus className="h-4 w-4" />
                      הוסף למערכת המסמכים
                    </button>
                  )}
                  {!!detail.shares?.length && (
                    <section>
                      <h3 className="mb-2 text-sm font-black">קישורי Share</h3>
                      <ul className="space-y-2">
                        {detail.shares.map((s: any) => (
                          <li
                            key={s.id}
                            className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs"
                          >
                            <span>{s.status}</span>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-sky-700"
                            >
                              <Link2 className="h-3 w-3" />
                              פתח
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {!!detail.signatures?.length && (
                    <section>
                      <h3 className="mb-2 text-sm font-black">חתימות</h3>
                      <ul className="space-y-2 text-sm">
                        {detail.signatures.map((s: any, i: number) => (
                          <li key={i} className="rounded-xl bg-stone-50 px-3 py-2">
                            {s.role === "client" ? "לקוח" : "מנהל עבודה"}:{" "}
                            {s.name || "—"}
                            {s.at
                              ? ` · ${new Date(s.at).toLocaleString("he-IL")}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}

              {!detailLoading && detail && tab === "approvals" && (
                <ApprovalsTab rows={detail.approvals || []} />
              )}
              {!detailLoading && detail && tab === "requests" && (
                <FlowTab
                  empty="אין בקשות אישור בהיסטוריה"
                  rows={(detail.requests || []).map((r: any) => ({
                    id: r.id,
                    title: r.message || r.action,
                    meta: r.createdAt
                      ? new Date(r.createdAt).toLocaleString("he-IL")
                      : "",
                    sub: r.actorName,
                  }))}
                />
              )}
              {!detailLoading && detail && tab === "revisions" && (
                <FlowTab
                  empty="לא היו החזרות לתיקון"
                  rows={(detail.revisions || []).map((r: any) => ({
                    id: r.id,
                    title: r.message || "הוחזר לתיקון",
                    meta: r.createdAt
                      ? new Date(r.createdAt).toLocaleString("he-IL")
                      : "",
                    sub: r.actorName,
                  }))}
                />
              )}
              {!detailLoading && detail && tab === "versions" && (
                <div className="space-y-2">
                  {!(detail.versions || []).length && (
                    <p className="text-sm text-stone-400">אין גרסאות שמורות</p>
                  )}
                  {(detail.versions || []).map((v: any) => (
                    <a
                      key={v.id || v.version}
                      href={v.url || detail.list?.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-2xl border border-stone-200 px-4 py-3 hover:bg-stone-50"
                    >
                      <div>
                        <p className="font-black">V{v.version}</p>
                        <p className="text-xs text-stone-500">
                          {v.note || v.status || ""}
                          {v.createdAt
                            ? ` · ${new Date(v.createdAt).toLocaleString("he-IL")}`
                            : ""}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-stone-400" />
                    </a>
                  ))}
                </div>
              )}
              {!detailLoading && detail && tab === "related" && (
                <div className="space-y-2">
                  {!(detail.related || []).length && (
                    <p className="text-sm text-stone-400">אין מסמכים קשורים</p>
                  )}
                  {(detail.related || []).map((d: any) => (
                    <a
                      key={d.id}
                      href={d.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm hover:bg-stone-50"
                    >
                      <Folder className="mt-0.5 h-4 w-4 text-amber-500" />
                      <span>
                        <span className="font-bold">{d.kindLabel}</span>
                        <br />
                        <span className="text-xs text-stone-500">{d.name}</span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
              {!detailLoading && detail && tab === "conversation" && (
                <div className="space-y-3">
                  {(detail.conversation || []).length === 0 && (
                    <p className="text-sm text-stone-400">אין הודעות</p>
                  )}
                  {(detail.conversation || []).map((m: any) => (
                    <div
                      key={m.id}
                      className="rounded-2xl bg-stone-50 px-3 py-2 text-sm"
                    >
                      <p className="text-xs font-bold text-stone-500">
                        {m.actorName || "משתמש"}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap">
                        {m.body || m.message}
                      </p>
                    </div>
                  ))}
                  {detail.workflowDocumentId ? (
                    <div className="flex gap-2">
                      <input
                        value={convText}
                        onChange={(e) => setConvText(e.target.value)}
                        className="min-h-11 flex-1 rounded-xl border px-3 text-sm"
                        placeholder="הודעה על המסמך…"
                      />
                      <button
                        type="button"
                        disabled={busy || !convText.trim()}
                        onClick={() => void sendConversation()}
                        className="rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-50"
                      >
                        שלח
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400">
                      שיחה זמינה למסמכים המחוברים ל-Workflow
                    </p>
                  )}
                </div>
              )}
              {!detailLoading && detail && tab === "timeline" && (
                <ol className="space-y-2 border-r-2 border-amber-200 pr-4">
                  {(detail.timeline || []).length === 0 && (
                    <p className="text-sm text-stone-400">אין היסטוריה</p>
                  )}
                  {(detail.timeline || []).map((t: any) => (
                    <li key={t.id} className="text-sm">
                      <p className="font-bold">{t.message || t.action}</p>
                      <p className="text-xs text-stone-400">
                        {t.actorName ? `${t.actorName} · ` : ""}
                        {t.createdAt
                          ? new Date(t.createdAt).toLocaleString("he-IL")
                          : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {detail?.list && (
              <div className="flex gap-2 border-t border-stone-100 p-3">
                {detail.list.url && (
                  <a
                    href={detail.list.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-stone-900 text-sm font-bold text-white"
                  >
                    פתח מסמך
                  </a>
                )}
                {detail.kind === "work_diary" && (
                  <Link
                    href={`/operations/approvals/review/work_diary/${detail.entityId}`}
                    className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border text-sm font-bold"
                  >
                    מסך אישור
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {ensureAsk && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-black">הוספה למסמכים</h3>
            <p className="text-sm text-stone-600">
              האם ברצונך להוסיף מסמך זה למערכת המסמכים?
            </p>
            <p className="text-sm font-bold">{ensureAsk.title || ensureAsk.hubKey}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEnsureAsk(null)}
                className="flex-1 rounded-xl border py-3 text-sm font-bold"
              >
                לא
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void ensureArchive(ensureAsk)}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 py-3 text-sm font-black text-white"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                כן
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FolderChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-3 py-1.5 text-xs font-bold",
        active
          ? "bg-amber-100 text-amber-900"
          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
      )}
    >
      {label}
      <span className="mr-1 opacity-60">({count})</span>
    </button>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: StatusTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-bold",
        TONE_CLASS[tone] || TONE_CLASS.gray
      )}
    >
      {label}
    </span>
  );
}

function ActionChip({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: typeof FileText;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1 rounded-xl px-3 text-xs font-bold",
        primary
          ? "bg-amber-600 text-white"
          : "border border-stone-200 text-stone-700"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function MetaGrid({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-stone-200 p-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <p key={k}>
          <span className="text-stone-400">{k}: </span>
          <span className="font-semibold">{v || "—"}</span>
        </p>
      ))}
    </div>
  );
}

function ApprovalsTab({ rows }: { rows: any[] }) {
  if (!rows.length) {
    return <p className="text-sm text-stone-400">אין בקשות אישור</p>;
  }
  return (
    <ul className="space-y-2">
      {rows.map((a) => (
        <li
          key={a.id}
          className="rounded-2xl border border-stone-200 px-3 py-2.5 text-sm"
        >
          <p className="font-bold">
            {a.icon === "ok" && "✔ "}
            {a.icon === "wait" && "🕒 "}
            {a.icon === "reject" && "✖ "}
            {a.name}
            {a.role ? ` · ${a.role}` : ""} — {a.label}
          </p>
          {a.comment && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-stone-600">
              {a.comment}
            </p>
          )}
          <p className="mt-1 text-xs text-stone-400">
            {a.decidedAt
              ? `הוחלט: ${new Date(a.decidedAt).toLocaleString("he-IL")}`
              : a.sentAt
                ? `נשלח: ${new Date(a.sentAt).toLocaleString("he-IL")}`
                : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

function FlowTab({
  rows,
  empty,
}: {
  rows: { id: string; title: string; meta?: string; sub?: string | null }[];
  empty: string;
}) {
  if (!rows.length) return <p className="text-sm text-stone-400">{empty}</p>;
  return (
    <ol className="space-y-0">
      {rows.map((r, i) => (
        <li key={r.id} className="relative pb-4 pr-6">
          {i < rows.length - 1 && (
            <span className="absolute right-[7px] top-3 bottom-0 w-0.5 bg-amber-200" />
          )}
          <span className="absolute right-0 top-1.5 h-3.5 w-3.5 rounded-full bg-amber-500" />
          <p className="font-bold text-sm">{r.title}</p>
          {(r.sub || r.meta) && (
            <p className="text-xs text-stone-400">
              {[r.sub, r.meta].filter(Boolean).join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
