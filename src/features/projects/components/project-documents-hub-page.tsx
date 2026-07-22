"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  Download,
  FileText,
  Folder,
  Paperclip,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge, useToast } from "@/components/ui";
import { documentService } from "@/features/documents/services/document.service";
import { uploadService } from "@/features/documents/services/upload.service";
import {
  DOCUMENT_ARCHIVE_FOLDERS,
  guessDocumentFolderId,
} from "@/lib/documents/archive-folders";
import { formatDate } from "@/utils/format";
import type { Document } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  excel: "Excel",
  word: "Word",
  dwg: "DWG",
  image: "תמונה",
  video: "וידאו",
  other: "אחר",
};

function formatSize(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectDocumentsHubPage({
  projectId,
  embedded = false,
}: {
  projectId: string;
  embedded?: boolean;
}) {
  const toast = useToast();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DOCUMENT_ARCHIVE_FOLDERS.map((f) => [f.id, true]))
  );
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Document | null>(null);
  const [attaching, setAttaching] = useState(false);

  function reload() {
    return documentService.getByProject(projectId).then(setDocs);
  }

  useEffect(() => {
    (async () => {
      try {
        // מיגרציה שקטה של תמונות ישנות (גלריה → מסמכים) — חד-פעמית / אידמפוטנטית
        await documentService.migrateGallery().catch(() => null);
        await reload();
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const byFolder = useMemo(() => {
    const map: Record<string, Document[]> = Object.fromEntries(
      DOCUMENT_ARCHIVE_FOLDERS.map((f) => [f.id, [] as Document[]])
    );
    for (const doc of docs) {
      if (!doc.url && (doc.size === 0 || doc.name.includes("תיקייה"))) continue;
      const id = guessDocumentFolderId(doc);
      (map[id] ?? map.general).push(doc);
    }
    return map;
  }, [docs]);

  const matchesQuery = (d: Document, q: string) => {
    if (!q) return true;
    const hay = [
      d.name,
      d.folderPath ?? "",
      ...(d.attachments ?? []).map((a) => a.name),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  };

  const visibleFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DOCUMENT_ARCHIVE_FOLDERS.filter((f) => {
      if (activeFolder !== "all" && activeFolder !== f.id) return false;
      const list = byFolder[f.id] ?? [];
      if (!q) return true;
      return list.some((d) => matchesQuery(d, q));
    });
  }, [activeFolder, byFolder, query]);

  async function onUpload(fileList: FileList | null, folderPath?: string) {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        await uploadService.uploadFile({
          file,
          projectId,
          type: isImage ? "image" : isVideo ? "video" : "document",
          folderPath:
            folderPath ||
            (isImage ? "תמונות" : isVideo ? "סרטונים" : "מסמכים כלליים"),
        });
      }
      toast.success("הקובץ הועלה למסמכים");
      await reload();
    } catch (e: any) {
      toast.error(e.message || "שגיאה בהעלאה");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(doc: Document) {
    if (!window.confirm(`למחוק את ${doc.name}?`)) return;
    try {
      await uploadService.deleteFile(doc.id, "document");
      toast.success("נמחק");
      if (selected?.id === doc.id) setSelected(null);
      await reload();
    } catch (e: any) {
      toast.error(e.message || "לא ניתן למחוק");
    }
  }

  async function openDocument(doc: Document) {
    try {
      const full = await documentService.getById(doc.id);
      setSelected(full);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function onAttach(fileList: FileList | null) {
    if (!selected || !fileList?.length) return;
    setAttaching(true);
    try {
      let updated = selected;
      for (const file of Array.from(fileList)) {
        updated = await documentService.uploadAttachment(selected.id, file);
      }
      setSelected(updated);
      await reload();
      toast.success("הקובץ נוסף למסמך");
    } catch (e: any) {
      toast.error(e.message || "שגיאה בהעלאה");
    } finally {
      setAttaching(false);
    }
  }

  async function onDeleteAttachment(attachmentId: string) {
    if (!selected) return;
    if (!window.confirm("למחוק את הקובץ המצורף?")) return;
    try {
      const updated = await documentService.deleteAttachment(attachmentId);
      setSelected(updated);
      await reload();
      toast.success("הקובץ נמחק");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (loading) return <p className="p-6 text-sm text-gray-500">טוען…</p>;

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!embedded && (
            <Link
              href={`/invoices?projectId=${projectId}`}
              className="text-gray-500"
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
          )}
          <div>
            <h2 className={embedded ? "text-lg font-bold" : "text-xl font-bold"}>
              מסמכים
            </h2>
            <p className="text-sm text-gray-500">
              מקור אמת יחיד · {docs.length} מסמכים · כולל תמונות וסרטונים
            </p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white">
          <Upload className="h-4 w-4" />
          {uploading ? "מעלה…" : "העלאת קובץ"}
          <input
            type="file"
            className="hidden"
            multiple
            accept="*/*"
            disabled={uploading}
            onChange={(e) => onUpload(e.target.files)}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm min-w-[200px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-xl border border-gray-200 py-2 pr-9 pl-3 text-sm"
            placeholder='חיפוש בכל המסמכים והקבצים… לדוגמה "חדר 4"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setActiveFolder("all")}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            activeFolder === "all"
              ? "bg-primary-50 font-semibold text-primary-700"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          הכל
        </button>
        {DOCUMENT_ARCHIVE_FOLDERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFolder(f.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              activeFolder === f.id
                ? "bg-primary-50 font-semibold text-primary-700"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {f.label}
            <span className="mr-1 text-xs text-gray-400">
              ({byFolder[f.id]?.length ?? 0})
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visibleFolders.map((folder) => {
          const q = query.trim().toLowerCase();
          const list = (byFolder[folder.id] ?? []).filter((d) =>
            matchesQuery(d, q)
          );
          const isOpen = expanded[folder.id] !== false;

          return (
            <div
              key={folder.id}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-right hover:bg-gray-50"
                onClick={() =>
                  setExpanded((e) => ({ ...e, [folder.id]: !isOpen }))
                }
              >
                <Folder className="h-5 w-5 text-amber-500" />
                <span className="flex-1 font-semibold text-gray-900">
                  {folder.label}
                </span>
                <Badge className="border-gray-200 bg-gray-50 text-gray-600">
                  {list.length}
                </Badge>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronLeft className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-3 pb-3">
                  {!list.length ? (
                    <p className="px-2 py-4 text-center text-sm text-gray-400">
                      התיקייה ריקה
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {list.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3"
                        >
                          <button
                            type="button"
                            onClick={() => void openDocument(doc)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-gray-500"
                          >
                            {doc.type === "image" && doc.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={doc.url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <FileText className="h-5 w-5" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => void openDocument(doc)}
                              className="truncate text-sm font-semibold text-right hover:text-primary-700"
                            >
                              {doc.name}
                            </button>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Badge className="border-gray-200 bg-white text-gray-600">
                                {TYPE_LABELS[doc.type] ?? doc.type}
                              </Badge>
                              {(doc.attachmentCount ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                                  <Paperclip className="h-3 w-3" />
                                  {doc.attachmentCount}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">
                                {formatSize(doc.size)} · {doc.uploadedBy} ·{" "}
                                {formatDate(doc.uploadedAt)}
                              </span>
                            </div>
                            <div className="mt-2 flex gap-3">
                              <button
                                type="button"
                                onClick={() => void openDocument(doc)}
                                className="text-xs font-semibold text-primary-700"
                              >
                                פרטים וקבצים
                              </button>
                              {doc.url ? (
                                <>
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-semibold text-gray-600"
                                  >
                                    תצוגה
                                  </a>
                                  <a
                                    href={doc.url}
                                    download
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600"
                                  >
                                    <Download className="h-3 w-3" />
                                    הורדה
                                  </a>
                                </>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => onDelete(doc)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"
                              >
                                <Trash2 className="h-3 w-3" />
                                מחק
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selected.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {selected.folderPath || "מסמכים"} ·{" "}
                  {TYPE_LABELS[selected.type] ?? selected.type} ·{" "}
                  {selected.uploadedBy} · {formatDate(selected.uploadedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {selected.url && (
              <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                {selected.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.url}
                    alt={selected.name}
                    className="max-h-64 w-full object-contain"
                  />
                ) : selected.type === "video" ? (
                  <video
                    src={selected.url}
                    controls
                    className="max-h-64 w-full"
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3 p-4">
                    <span className="text-sm text-gray-600">קובץ ראשי</span>
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-primary-700"
                    >
                      פתיחה / הורדה
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-gray-900">קבצים מצורפים</h4>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                <Paperclip className="h-3.5 w-3.5" />
                {attaching ? "מעלה…" : "הוסף קובץ"}
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept="*/*"
                  disabled={attaching}
                  onChange={(e) => onAttach(e.target.files)}
                />
              </label>
            </div>

            {!selected.attachments?.length ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                אין קבצים מצורפים — ניתן להעלות תמונות, PDF, סרטונים ועוד
              </p>
            ) : (
              <div className="space-y-2">
                {selected.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
                      {att.type === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={att.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-gray-400">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{att.name}</p>
                      <p className="text-xs text-gray-400">
                        {TYPE_LABELS[att.type] ?? att.type} ·{" "}
                        {formatSize(att.size)} · {att.uploadedBy} ·{" "}
                        {formatDate(att.uploadedAt)}
                      </p>
                    </div>
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-primary-700"
                    >
                      תצוגה
                    </a>
                    <a
                      href={att.url}
                      download
                      className="text-xs font-semibold text-gray-600"
                    >
                      הורדה
                    </a>
                    <button
                      type="button"
                      onClick={() => void onDeleteAttachment(att.id)}
                      className="text-xs font-semibold text-red-600"
                    >
                      מחק
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
