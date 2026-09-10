"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  FilePlus2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Signature,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Button, Modal } from "@/components/ui";
import type {
  DocumentTimelineEvent,
  TimelineCategory,
  TimelineDocumentKind,
} from "@/repositories/document-timeline.repository";

type TimelineResponse = {
  items: DocumentTimelineEvent[];
  projects: { id: string; name: string }[];
  summary: {
    pending: number;
    revision: number;
    approvedToday: number;
    actionsToday: number;
  };
};

const EMPTY_RESPONSE: TimelineResponse = {
  items: [],
  projects: [],
  summary: { pending: 0, revision: 0, approvedToday: 0, actionsToday: 0 },
};

const KIND_LABELS: Record<TimelineDocumentKind, string> = {
  work_diary: "יומני עבודה",
  delivery_note: "תעודות משלוח",
  measurement: "מדידות",
  invoice: "חשבונות",
};

const STATUS_LABELS: Record<TimelineCategory, string> = {
  approved: "אושרו",
  pending: "ממתינים לאישור",
  revision: "הוחזרו לתיקון",
  signed: "נחתמו",
  created: "נוצרו",
  updated: "עודכנו",
  info: "מידע כללי",
};

const TONE = {
  green: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    icon: "text-emerald-600",
  },
  orange: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    icon: "text-amber-600",
  },
  red: {
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-800 ring-red-200",
    icon: "text-red-600",
  },
  blue: {
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-800 ring-blue-200",
    icon: "text-blue-600",
  },
  gray: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: "text-slate-500",
  },
} as const;

function EventIcon({ event }: { event: DocumentTimelineEvent }) {
  const className = `h-4 w-4 ${TONE[event.tone].icon}`;
  if (event.category === "approved")
    return <CheckCircle2 className={className} />;
  if (event.category === "revision")
    return <RotateCcw className={className} />;
  if (event.category === "pending") return <Send className={className} />;
  if (event.category === "signed") return <Signature className={className} />;
  if (event.category === "created")
    return <FilePlus2 className={className} />;
  if (event.category === "updated") return <Pencil className={className} />;
  return <Circle className={className} />;
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = date.toLocaleDateString("en-CA");
  if (key === today.toLocaleDateString("en-CA")) return "היום";
  if (key === yesterday.toLocaleDateString("en-CA")) return "אתמול";
  return date.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function eventTime(value: string) {
  return new Date(value).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const URL_RE = /https?:\/\/[^\s]+/gi;
const FILE_NAME_RE =
  /[\w.\-()[\]]+\.(?:jpe?g|png|gif|webp|pdf|docx?|xlsx?|heic|mp4|mov)\b/i;

function extractUrl(value: string): string | null {
  const match = value.match(URL_RE);
  return match?.[0] ?? null;
}

function fileNameFromText(value: string): string | null {
  try {
    const url = extractUrl(value);
    if (url) {
      const path = new URL(url).pathname;
      const name = decodeURIComponent(path.split("/").pop() || "");
      if (name) return name;
    }
  } catch {
    /* keep fallback below */
  }
  const fileMatch = value.match(FILE_NAME_RE);
  return fileMatch?.[0] ?? null;
}

function textWithoutUrls(value: string) {
  return value.replace(URL_RE, " ").replace(/\s+/g, " ").trim();
}

function isAttachmentLike(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (extractUrl(trimmed)) return true;
  if (FILE_NAME_RE.test(trimmed) && trimmed.length > 40) return true;
  return /קובץ|מצורף|attachment|whatsapp_image/i.test(trimmed);
}

/** Soft-truncate long filenames for display; full value stays in the link. */
function shortFileName(name: string, max = 36) {
  if (name.length <= max) return name;
  const extIndex = name.lastIndexOf(".");
  if (extIndex > 0 && name.length - extIndex <= 8) {
    const ext = name.slice(extIndex);
    const keep = Math.max(8, max - ext.length - 1);
    return `${name.slice(0, keep)}…${ext}`;
  }
  return `${name.slice(0, max - 1)}…`;
}

const wrapText =
  "max-w-full min-w-0 break-words [overflow-wrap:anywhere] whitespace-normal";
const wrapLtr =
  "max-w-full min-w-0 break-all [overflow-wrap:anywhere] whitespace-normal [direction:ltr]";

export function WorkflowCenterPage() {
  const pathname = usePathname();
  const apiPath = pathname.startsWith("/field")
    ? "/api/field/workflow/timeline"
    : "/api/workflow/timeline";
  const [data, setData] = useState<TimelineResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("30");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DocumentTimelineEvent | null>(null);
  const [documentEvents, setDocumentEvents] = useState<
    DocumentTimelineEvent[]
  >([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ period, take: "300" });
    if (projectId) params.set("projectId", projectId);
    if (kind) params.set("kind", kind);
    if (status) params.set("status", status);
    if (query.trim()) params.set("q", query.trim());
    try {
      const response = await apiClient.get<TimelineResponse>(
        `${apiPath}?${params.toString()}`
      );
      setData(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "טעינת ציר התהליכים נכשלה"
      );
    } finally {
      setLoading(false);
    }
  }, [apiPath, kind, period, projectId, query, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void reload(), 180);
    return () => window.clearTimeout(timeout);
  }, [reload]);

  async function openDocumentTimeline(event: DocumentTimelineEvent) {
    setSelected(event);
    setDocumentEvents([]);
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({
        documentKey: event.documentKey,
        period: "all",
        take: "500",
      });
      const response = await apiClient.get<TimelineResponse>(
        `${apiPath}?${params.toString()}`
      );
      setDocumentEvents(
        [...response.items].sort(
          (a, b) =>
            new Date(a.occurredAt).getTime() -
            new Date(b.occurredAt).getTime()
        )
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "טעינת היסטוריית המסמך נכשלה"
      );
    } finally {
      setDetailLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const groups = new Map<string, DocumentTimelineEvent[]>();
    for (const event of data.items) {
      const label = dayLabel(event.occurredAt);
      const current = groups.get(label) ?? [];
      current.push(event);
      groups.set(label, current);
    }
    return [...groups.entries()];
  }, [data.items]);

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-5 overflow-x-hidden" dir="rtl">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-slate-950">מרכז תהליכים</h1>
          <p className={`mt-1 text-sm text-slate-500 ${wrapText}`}>
            מעקב אחר מסמכים, אישורים, תיקונים וחשבונות
          </p>
        </div>
        <Button variant="outline" onClick={() => void reload()}>
          <RefreshCw className="h-4 w-4" />
          רענון
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="ממתינים לאישור"
          value={data.summary.pending}
          tone="orange"
          active={status === "pending"}
          onClick={() => setStatus(status === "pending" ? "" : "pending")}
        />
        <SummaryCard
          label="הוחזרו לתיקון"
          value={data.summary.revision}
          tone="red"
          active={status === "revision"}
          onClick={() => setStatus(status === "revision" ? "" : "revision")}
        />
        <SummaryCard
          label="אושרו היום"
          value={data.summary.approvedToday}
          tone="green"
          active={status === "approved"}
          onClick={() => setStatus(status === "approved" ? "" : "approved")}
        />
        <SummaryCard
          label="פעולות היום"
          value={data.summary.actionsToday}
          tone="blue"
          active={period === "1" && !status}
          onClick={() => {
            setPeriod("1");
            setStatus("");
          }}
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <label className="relative block">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חפש מספר מסמך / פרויקט / משתמש"
            className="h-11 w-full rounded-xl border border-slate-200 pr-10 pl-3 text-sm outline-none focus:border-blue-400"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <FilterSelect
            value={projectId}
            onChange={setProjectId}
            label="כל הפרויקטים"
            options={data.projects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
          />
          <FilterSelect
            value={kind}
            onChange={setKind}
            label="כל המסמכים"
            options={Object.entries(KIND_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <FilterSelect
            value={status}
            onChange={setStatus}
            label="כל הסטטוסים"
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <FilterSelect
            value={period}
            onChange={setPeriod}
            label="כל התקופות"
            options={[
              { value: "1", label: "היום" },
              { value: "7", label: "7 ימים" },
              { value: "30", label: "30 ימים" },
              { value: "90", label: "90 ימים" },
              { value: "all", label: "כל התקופה" },
            ]}
            includeEmpty={false}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-400">
          טוען ציר תהליכים…
        </p>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center text-sm text-slate-500">
          לא נמצאו אירועים התואמים לסינון
        </div>
      ) : (
        <div className="space-y-7">
          {grouped.map(([label, events]) => (
            <section key={label}>
              <h2 className="mb-3 text-sm font-black text-slate-700">{label}</h2>
              <div className="relative min-w-0 space-y-1 before:absolute before:top-4 before:bottom-4 before:right-[19px] before:w-px before:bg-slate-200">
                {events.map((event) => (
                  <TimelineRow
                    key={event.id}
                    event={event}
                    onOpenTimeline={() => void openDocumentTimeline(event)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          selected ? `ציר תהליך — ${selected.documentNumber}` : "ציר תהליך"
        }
        description={selected?.title}
        size="lg"
      >
        {detailLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">טוען…</p>
        ) : (
          <div className="min-w-0 space-y-4 overflow-x-hidden">
            {selected && (
              <a
                href={selected.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                פתיחת המסמך
              </a>
            )}
            <div className="relative min-w-0 space-y-4 before:absolute before:top-3 before:bottom-3 before:right-[7px] before:w-px before:bg-slate-200">
              {documentEvents.map((event) => (
                <div key={event.id} className="relative min-w-0 pr-7">
                  <span
                    className={`absolute right-0 top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-white ${TONE[event.tone].dot}`}
                  />
                  <div className="min-w-0">
                    <EventMessage text={event.message} />
                    <p className={`mt-1 text-xs text-slate-500 ${wrapText}`}>
                      {new Date(event.occurredAt).toLocaleString("he-IL")}
                      {event.actorName ? ` · ${event.actorName}` : ""}
                    </p>
                    {event.note && <CorrectionNote note={event.note} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EventMessage({ text }: { text: string }) {
  const url = extractUrl(text);
  const fileName = fileNameFromText(text);
  const cleaned = textWithoutUrls(text);
  const attachmentOnly =
    isAttachmentLike(text) && (!cleaned || cleaned.length < 8);

  if (attachmentOnly && (url || fileName)) {
    return (
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-black text-slate-950">קובץ מצורף</p>
        {fileName && (
          <p className={`text-xs font-semibold text-slate-600 ${wrapLtr}`} title={fileName}>
            {shortFileName(fileName)}
          </p>
        )}
      </div>
    );
  }

  return (
    <p className={`font-black text-slate-950 ${wrapText}`}>{cleaned || text}</p>
  );
}

function CorrectionNote({ note }: { note: string }) {
  const url = extractUrl(note);
  const fileName = fileNameFromText(note);
  const cleaned = textWithoutUrls(note);
  const showAttachment = isAttachmentLike(note) && Boolean(url || fileName);

  return (
    <div
      className={`mt-2 box-border w-full max-w-full rounded-lg border-r-2 border-red-400 bg-red-50 px-3 py-2 text-xs text-red-800 ${wrapText}`}
      dir="rtl"
    >
      {cleaned ? (
        <p className={wrapText}>
          <span className="font-bold">סיבה: </span>
          {cleaned}
        </p>
      ) : (
        <p className="font-bold">סיבה:</p>
      )}
      {showAttachment && (
        <div className="mt-2 min-w-0 space-y-1.5 border-t border-red-200/70 pt-2">
          <p className="font-bold text-red-900">קובץ מצורף</p>
          {fileName && (
            <p className={`font-semibold text-red-900/80 ${wrapLtr}`} title={fileName}>
              {shortFileName(fileName)}
            </p>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
              className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg bg-white px-2.5 text-[11px] font-bold text-red-800 ring-1 ring-red-200"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              צפייה בקובץ
            </a>
          )}
        </div>
      )}
      {!showAttachment && !cleaned && note && (
        <p className={`mt-1 ${wrapLtr}`}>{note}</p>
      )}
    </div>
  );
}

function TimelineRow({
  event,
  onOpenTimeline,
}: {
  event: DocumentTimelineEvent;
  onOpenTimeline: () => void;
}) {
  const noteUrl = event.note ? extractUrl(event.note) : null;
  const messageUrl = extractUrl(event.message);
  const attachmentUrl = noteUrl || messageUrl;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpenTimeline}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === "Enter" || keyEvent.key === " ") onOpenTimeline();
      }}
      className="group relative grid w-full min-w-0 cursor-pointer grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-2xl px-1 py-3 transition hover:bg-white hover:shadow-sm sm:grid-cols-[70px_40px_minmax(0,1fr)]"
    >
      <time className="hidden min-w-0 pt-1 text-left text-xs font-bold text-slate-500 sm:block">
        {eventTime(event.occurredAt)}
      </time>
      <div className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white ring-1 ring-slate-200">
        <EventIcon event={event} />
      </div>
      <div className="min-w-0 max-w-full flex-1 space-y-2 pb-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 sm:hidden">
            {eventTime(event.occurredAt)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${TONE[event.tone].badge}`}
          >
            {STATUS_LABELS[event.category]}
          </span>
          <span className="text-xs text-slate-400">
            {KIND_LABELS[event.kind]}
          </span>
        </div>
        <EventMessage text={event.message} />
        <p className={`text-sm text-slate-600 ${wrapText}`}>
          {event.projectName}
          {event.actorName ? ` · ${event.actorName}` : ""}
        </p>
        {event.note && <CorrectionNote note={event.note} />}
        <div className="flex min-w-0 flex-wrap gap-2 pt-0.5">
          {attachmentUrl && (
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
              className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              קובץ מצורף
            </a>
          )}
          <a
            href={event.documentUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
            className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-lg text-xs font-bold text-blue-700 opacity-90 group-hover:opacity-100"
          >
            פתיחת המסמך
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        </div>
      </div>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: keyof typeof TONE;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-white p-4 text-right transition hover:shadow-sm ${
        active ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className="mt-2 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${TONE[tone].dot}`} />
        <strong className="text-2xl text-slate-950">{value}</strong>
      </span>
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
  includeEmpty = true,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: { value: string; label: string }[];
  includeEmpty?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
    >
      {includeEmpty && <option value="">{label}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
