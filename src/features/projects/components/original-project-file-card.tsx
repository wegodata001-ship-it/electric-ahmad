"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Eye, FileText, Upload } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type OriginalDoc = {
  document: {
    id: string;
    fileName: string;
    name: string;
    size: number;
  } | null;
  viewUrl: string | null;
  canReplace: boolean;
};

export function OriginalProjectFileCard({
  projectId,
  compact = false,
}: {
  projectId: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<OriginalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get<OriginalDoc>(`/api/projects/${projectId}/original-document`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "שגיאה בטעינת מסמך המקור");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiClient.upload<OriginalDoc>(
        `/api/projects/${projectId}/original-document`,
        form
      );
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "העלאת הקובץ נכשלה");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const fileName = data?.document?.fileName;
  const viewUrl = data?.viewUrl;

  if (compact) {
    return (
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400">מסמך מקור</p>
        {loading ? (
          <p className="text-sm text-slate-400">טוען…</p>
        ) : fileName && viewUrl ? (
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
            <p className="truncate font-semibold text-slate-800">{fileName}</p>
            <button
              type="button"
              className="shrink-0 text-xs font-semibold text-primary-700 hover:underline"
              onClick={() => setPreviewOpen(true)}
            >
              צפייה
            </button>
          </div>
        ) : (
          <p className="text-sm font-semibold text-amber-700">
            לא הועלה מסמך מקור
          </p>
        )}
        <PreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          fileName={fileName}
          viewUrl={viewUrl ?? null}
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
      data-project-tree="original-pdf"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <FileText className="h-5 w-5 text-slate-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900">קובץ פרויקט מקורי</p>
          {loading ? (
            <p className="mt-1 text-xs text-slate-400">טוען…</p>
          ) : fileName ? (
            <p className="mt-1 truncate text-sm text-slate-600">{fileName}</p>
          ) : (
            <p className="mt-1 text-sm text-amber-700">לא הועלה מסמך מקור</p>
          )}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </div>

      <div className={cn("mt-3 flex flex-wrap gap-2", !fileName && "pt-0")}>
        {fileName && viewUrl && (
          <>
            <Button size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-3.5 w-3.5" />
              צפייה ב-PDF
            </Button>
            <a
              href={viewUrl}
              download={fileName}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-primary-200 px-3 text-xs font-medium text-primary-700 hover:bg-primary-50"
            >
              <Download className="h-3.5 w-3.5" />
              הורדה
            </a>
          </>
        )}
        {data?.canReplace && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files)}
            />
            <Button
              size="sm"
              variant={fileName ? "outline" : "primary"}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading
                ? "מעלה…"
                : fileName
                  ? "החלפת קובץ מקור"
                  : "העלה PDF"}
            </Button>
          </>
        )}
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        fileName={fileName}
        viewUrl={viewUrl ?? null}
      />
    </div>
  );
}

function PreviewModal({
  open,
  onClose,
  fileName,
  viewUrl,
}: {
  open: boolean;
  onClose: () => void;
  fileName?: string;
  viewUrl: string | null;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="קובץ פרויקט מקורי"
      description={fileName}
      size="full"
    >
      {viewUrl ? (
        <iframe
          title={fileName || "PDF"}
          src={viewUrl}
          className="h-[75vh] w-full rounded-lg border border-slate-200 bg-slate-50"
        />
      ) : (
        <p className="py-10 text-center text-sm text-slate-500">
          לא ניתן לפתוח את הקובץ
        </p>
      )}
    </Modal>
  );
}
