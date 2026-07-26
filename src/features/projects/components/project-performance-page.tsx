"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  GripVertical,
  Maximize2,
  Minimize2,
  Plus,
  Save,
  X,
} from "lucide-react";
import {
  Button,
  ConfirmationDialog,
  Modal,
  useToast,
} from "@/components/ui";
import { formatNumber } from "@/utils/format";
import { invoicesWorkspaceService } from "@/features/partial-invoices/services/invoices-workspace.service";
import { invoiceService } from "@/features/partial-invoices/services/invoice.service";
import { SendInvoiceApprovalModal } from "@/features/partial-invoices/components/send-invoice-approval-modal";
import { RevisionFeedbackBanner } from "@/features/approvals/components/revision-feedback-banner";
import { approvalsService } from "@/features/work-diaries/services/work-diaries.service";
import { boqService } from "@/features/boq/services/boq.service";
import { ProjectRoomsToolbar } from "@/features/projects/components/project-rooms-toolbar";
import {
  buildMeasurementSheetExcel,
  downloadBlob,
} from "@/lib/measurement/export-excel";
import type { BoqItem } from "@/types";
import { cn } from "@/lib/utils";

type DraftMap = Record<string, string>;

/**
 * דף מדידה בסגנון Excel:
 * שורות = חדרים/יחידות, עמודות = סעיפי BOQ
 */
export function ProjectPerformancePage({
  projectId,
  embedded = false,
}: {
  projectId: string;
  embedded?: boolean;
}) {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [sheets, setSheets] = useState<any[]>([]);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<any>(null);
  const [boq, setBoq] = useState<BoqItem[]>([]);
  const [draft, setDraft] = useState<DraftMap>({});
  const [saved, setSaved] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragRoomId, setDragRoomId] = useState<string | null>(null);

  // Submit / invoice / ops review flow
  const [completing, setCompleting] = useState(false);
  const [askInvoice, setAskInvoice] = useState(false);
  const [invoicePreview, setInvoicePreview] = useState<any>(null);
  const [invoiceDraftId, setInvoiceDraftId] = useState<string | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [approverOpen, setApproverOpen] = useState(false);
  const [submitApproverOpen, setSubmitApproverOpen] = useState(false);
  const [askSaveInvoiceDoc, setAskSaveInvoiceDoc] = useState(false);
  const [savingInvoiceDoc, setSavingInvoiceDoc] = useState(false);
  const [approvers, setApprovers] = useState<
    Awaited<ReturnType<typeof invoiceService.listApprovers>>
  >([]);
  const [selectedApproverIds, setSelectedApproverIds] = useState<string[]>([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [opsRejectOpen, setOpsRejectOpen] = useState(false);
  const [opsRejectComment, setOpsRejectComment] = useState("");
  const [opsMarkedRooms, setOpsMarkedRooms] = useState<string[]>([]);
  const [opsDeciding, setOpsDeciding] = useState(false);
  const [ensuringGrid, setEnsuringGrid] = useState(false);
  const [gridEnsuredFor, setGridEnsuredFor] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [versionPreview, setVersionPreview] = useState<any | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveAllRef = useRef<() => Promise<boolean>>(async () => false);

  const locked = sheet ? sheet.editable === false : false;
  const isRevision = sheet?.status === "revision";
  const isApproved =
    sheet?.status === "approved" || sheet?.status === "locked";
  const isPending = sheet?.status === "pending_approval";
  const activeReviewNotes = useMemo(() => {
    const notes = sheet?.reviewNotes ?? [];
    if (!notes.length) return [];
    const ver = sheet?.currentVersion ?? 1;
    const forVersion = notes.filter((n: any) => n.version === ver);
    return forVersion.length ? forVersion : notes;
  }, [sheet]);
  const revisionCount = sheets.filter((s) => s.status === "revision").length;

  const STATUS_UI: Record<string, { label: string; className: string }> = {
    draft: { label: "טיוטה", className: "bg-gray-100 text-gray-700" },
    in_progress: { label: "בעבודה", className: "bg-sky-50 text-sky-800" },
    pending_approval: {
      label: "ממתין לאישור",
      className: "bg-amber-50 text-amber-800",
    },
    revision: { label: "דורש תיקון", className: "bg-orange-50 text-orange-800" },
    approved: { label: "מאושר", className: "bg-emerald-50 text-emerald-800" },
    locked: { label: "מאושר", className: "bg-emerald-50 text-emerald-800" },
    invoiced: { label: "הופק לחשבון", className: "bg-violet-50 text-violet-800" },
  };

  function applySheet(s: any) {
    setSheet(s);
    const next: DraftMap = {};
    for (const c of s.cells ?? []) {
      next[`${c.rowId}:${c.boqItemId}`] = String(c.quantity ?? 0);
    }
    setDraft(next);
    setSaved(next);
  }

  /** BOQ columns from sheet cells — avoids duplicate /api/boq when grid already has items. */
  function boqFromSheetCells(s: any): BoqItem[] {
    const map = new Map<string, BoqItem>();
    for (const c of s?.cells ?? []) {
      if (c?.boqItem?.id) map.set(c.boqItem.id, c.boqItem as BoqItem);
    }
    return [...map.values()];
  }

  async function resolveBoqForSheet(s: any): Promise<BoqItem[]> {
    const fromCells = boqFromSheetCells(s);
    if (fromCells.length) return fromCells;
    return boqService.getByProject(projectId);
  }

  const suppressSheetFetch = useRef(false);

  /** Bootstrap: listSheets + sheet (when id known). BOQ only if cells lack items. */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSheet(null);
    setSheetId(null);
    suppressSheetFetch.current = true;
    (async () => {
      try {
        const urlSheetId = searchParams.get("sheetId");
        const [sheetsRes, earlySheet] = await Promise.all([
          invoicesWorkspaceService.listSheets(projectId),
          urlSheetId
            ? invoicesWorkspaceService.getSheet(urlSheetId).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setSheets(sheetsRes.items);
        const fromUrl =
          urlSheetId &&
          sheetsRes.items.some((s: { id: string }) => s.id === urlSheetId)
            ? urlSheetId
            : null;
        const id = fromUrl || sheetsRes.items[0]?.id || null;
        if (earlySheet && (earlySheet as { id?: string }).id === id) {
          applySheet(earlySheet);
          setSheetId(id);
          const items = await resolveBoqForSheet(earlySheet);
          if (!cancelled) setBoq(items);
        } else if (id) {
          const s = await invoicesWorkspaceService.getSheet(id);
          if (cancelled) return;
          applySheet(s);
          setSheetId(id);
          const items = await resolveBoqForSheet(s);
          if (!cancelled) setBoq(items);
        } else {
          setSheet(null);
          setSheetId(null);
          setBoq([]);
        }
      } catch (e: any) {
        if (!cancelled) toast.error(e.message);
      } finally {
        suppressSheetFetch.current = false;
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  /** User switched sheet in the UI — reload only when id differs from loaded sheet. */
  useEffect(() => {
    if (suppressSheetFetch.current) return;
    if (!sheetId) {
      setSheet(null);
      return;
    }
    if (sheet?.id === sheetId) return;
    let cancelled = false;
    invoicesWorkspaceService
      .getSheet(sheetId)
      .then(async (s) => {
        if (cancelled) return;
        applySheet(s);
        const items = await resolveBoqForSheet(s);
        if (!cancelled) setBoq(items);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [sheetId, sheet?.id, toast]);

  /** If sheet has rooms but no BOQ columns — build the fillable grid automatically. */
  useEffect(() => {
    if (!sheetId || !sheet || locked) return;
    if (gridEnsuredFor === sheetId) return;
    const roomCount = sheet.rows?.length ?? 0;
    const cellCount = sheet.cells?.length ?? 0;
    if (!roomCount || cellCount > 0) {
      setGridEnsuredFor(sheetId);
      return;
    }
    setEnsuringGrid(true);
    Promise.all([
      invoicesWorkspaceService.ensureGrid(sheetId, true),
      boqService.getByProject(projectId),
    ])
      .then(([s, items]) => {
        applySheet(s);
        setBoq(items);
        setGridEnsuredFor(sheetId);
        toast.success("טבלת המדידה מוכנה להזנה");
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setEnsuringGrid(false));
  }, [sheet, sheetId, locked, gridEnsuredFor, projectId, toast]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const rooms: any[] = sheet?.rows ?? [];

  const sections = useMemo(() => {
    const map = new Map<string, any>();
    for (const item of boq) {
      if (item?.id) map.set(item.id, item);
    }
    for (const c of sheet?.cells ?? []) {
      if (c.boqItem) map.set(c.boqItemId, c.boqItem);
    }
    return [...map.values()].sort((a, b) =>
      String(a.code ?? "").localeCompare(String(b.code ?? ""), "he")
    );
  }, [boq, sheet]);

  async function ensureFillableGrid() {
    if (!sheetId || locked) return;
    setEnsuringGrid(true);
    try {
      const [s, items] = await Promise.all([
        invoicesWorkspaceService.ensureGrid(sheetId, true),
        boqService.getByProject(projectId),
      ]);
      applySheet(s);
      setBoq(items);
      setGridEnsuredFor(sheetId);
      toast.success("טבלת המדידה מוכנה להזנה");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnsuringGrid(false);
    }
  }

  function cellKey(roomId: string, boqId: string) {
    return `${roomId}:${boqId}`;
  }

  const dirty = useMemo(() => {
    const keys = new Set([...Object.keys(draft), ...Object.keys(saved)]);
    for (const k of keys) {
      const a = Number(draft[k] ?? 0);
      const b = Number(saved[k] ?? 0);
      if (a !== b) return true;
    }
    return false;
  }, [draft, saved]);

  function roomTotal(roomId: string) {
    return sections.reduce((s, item) => {
      return s + (Number(draft[cellKey(roomId, item.id)]) || 0);
    }, 0);
  }

  function sectionTotal(boqId: string) {
    return rooms.reduce((s: number, u: any) => {
      return s + (Number(draft[cellKey(u.id, boqId)]) || 0);
    }, 0);
  }

  /** יתרה = מאושר − חויב − בוצע בדף זה */
  function sectionRemaining(item: any) {
    const contract = Number(item.contractQuantity) || 0;
    const invoiced = Number(item.invoicedQuantity) || 0;
    const done = sectionTotal(item.id);
    return Math.max(0, contract - invoiced - done);
  }

  async function saveAll(opts?: { silent?: boolean }): Promise<boolean> {
    if (!sheetId || locked) return false;
    const cells: { rowId: string; boqItemId: string; quantity: number }[] = [];
    const keys = new Set([...Object.keys(draft), ...Object.keys(saved)]);
    for (const key of keys) {
      const [rowId, boqItemId] = key.split(":");
      if (!rowId || !boqItemId) continue;
      const quantity = Math.max(0, Number(draft[key] ?? 0) || 0);
      const prev = Number(saved[key] ?? 0);
      if (quantity === prev) continue;
      cells.push({ rowId, boqItemId, quantity });
    }
    if (!cells.length) {
      if (!opts?.silent) toast.success("אין שינויים לשמירה");
      return true;
    }
    setSaving(true);
    try {
      await invoicesWorkspaceService.saveCells(sheetId, cells);
      // Fast path: keep local draft as source of truth (no full sheet reload)
      const next = { ...draft };
      for (const c of cells) {
        next[cellKey(c.rowId, c.boqItemId)] = String(c.quantity);
      }
      setDraft(next);
      setSaved({ ...next });
      if (!opts?.silent) toast.success("נשמר");
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  saveAllRef.current = () => saveAll({ silent: true });

  /** Autosave dirty cells in the background (debounced) */
  useEffect(() => {
    if (locked || !dirty || !sheetId) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void saveAllRef.current();
    }, 2500);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [draft, dirty, locked, sheetId]);

  async function exportExcel() {
    if (!sheet || !sections.length) {
      toast.error("אין נתונים לייצוא");
      return;
    }
    setExportingExcel(true);
    try {
      const columns = sections.map((item: any) => {
        const done = sectionTotal(item.id);
        const remaining = sectionRemaining(item);
        return {
          id: item.id,
          code: String(item.code ?? ""),
          description: String(item.description ?? ""),
          unit: item.unit,
          contractQuantity: Number(item.contractQuantity) || 0,
          invoicedQuantity: Number(item.invoicedQuantity) || 0,
          doneQuantity: done,
          remainingQuantity: remaining,
        };
      });
      const rows = rooms.map((room: any) => {
        const quantities: Record<string, number> = {};
        for (const item of sections) {
          quantities[item.id] =
            Number(draft[cellKey(room.id, item.id)]) || 0;
        }
        return {
          name: room.name,
          floor: room.floor,
          quantities,
          roomTotal: roomTotal(room.id),
        };
      });
      const blob = await buildMeasurementSheetExcel({
        title: sheet.title || `דף מדידה MS-${sheet.sequenceNumber}`,
        projectName: sheet.project?.name,
        clientName: sheet.project?.contractor,
        address: sheet.project?.location,
        version: sheet.currentVersion,
        statusLabel: STATUS_UI[sheet.status]?.label || sheet.status,
        columns,
        rows,
      });
      const safeName = (sheet.title || `MS-${sheet.sequenceNumber}`)
        .replace(/[\\/:*?"<>|]/g, "-")
        .slice(0, 80);
      downloadBlob(blob, `${safeName}-V${sheet.currentVersion || 1}.xlsx`);
      toast.success("הקובץ הורד");
    } catch (e: any) {
      toast.error(e?.message || "שגיאה בייצוא Excel");
    } finally {
      setExportingExcel(false);
    }
  }

  function openPdf() {
    if (!sheetId) return;
    window.open(`/print/measurement-sheets/${sheetId}`, "_blank");
  }

  async function refreshSheetLocal() {
    if (!sheetId) return;
    const s = await invoicesWorkspaceService.getSheet(sheetId);
    applySheet(s);
  }

  async function onRoomsChanged() {
    try {
      await refreshSheetLocal();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function reorderRoomsByRowIds(fromRowId: string, toRowId: string) {
    if (fromRowId === toRowId || locked) return;
    const ordered = rooms.map((r: any) => r.projectRoomId).filter(Boolean);
    const fromRoomId = rooms.find((r: any) => r.id === fromRowId)?.projectRoomId;
    const toRoomId = rooms.find((r: any) => r.id === toRowId)?.projectRoomId;
    if (!fromRoomId || !toRoomId) return;
    const fromIdx = ordered.indexOf(fromRoomId);
    const toIdx = ordered.indexOf(toRoomId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...ordered];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, fromRoomId);
    try {
      await invoicesWorkspaceService.reorderRooms(projectId, next);
      await refreshSheetLocal();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function createSheet() {
    setCreating(true);
    try {
      const created = await invoicesWorkspaceService.createSheet({
        projectId,
        title: "דף מדידה ראשי",
        rowNames: ["חדר 101", "חדר 102", "חדר 103"],
      });
      setSheetId(created.id);
      applySheet(created);
      await loadSheets();
      toast.success("דף מדידה נוצר");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function openSubmitFlow() {
    if (!sheetId) return;
    if (dirty) {
      const ok = await saveAll();
      if (!ok) return;
    }
    setLoadingApprovers(true);
    setSubmitApproverOpen(true);
    setSelectedApproverIds([]);
    try {
      const list = await invoiceService.listApprovers({
        includeFieldManagers: true,
      });
      setApprovers(list);
      // Default: Operations Manager (so opsmgr can actually approve)
      const opsIds = list
        .filter((a: any) => a.role === "OPERATIONS_MANAGER")
        .map((a: any) => a.id);
      setSelectedApproverIds(
        opsIds.length ? opsIds : list[0]?.id ? [list[0].id] : []
      );
    } catch (e: any) {
      toast.error(e.message);
      setSubmitApproverOpen(false);
    } finally {
      setLoadingApprovers(false);
    }
  }

  async function handleSubmitForApproval() {
    if (!sheetId || !selectedApproverIds.length) {
      toast.error("יש לבחור לפחות מאשר אחד");
      return;
    }
    setCompleting(true);
    try {
      await invoicesWorkspaceService.submitForApproval(
        sheetId,
        selectedApproverIds
      );
      const s = await invoicesWorkspaceService.getSheet(sheetId);
      applySheet(s);
      await loadSheets();
      setSubmitApproverOpen(false);
      toast.success("הדוח נשלח לאישור — סטטוס: ממתין לאישור");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCompleting(false);
    }
  }

  async function handleOpsApprove() {
    if (!sheetId) return;
    setOpsDeciding(true);
    try {
      await approvalsService.decide({
        kind: "measurement_sheet",
        documentId: sheetId,
        decision: "approved",
      });
      const s = await invoicesWorkspaceService.getSheet(sheetId);
      applySheet(s);
      await loadSheets();
      toast.success("הדוח אושר — ניתן להפיק חשבון");
      setAskInvoice(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setOpsDeciding(false);
    }
  }

  async function handleOpsReject() {
    if (!sheetId || !opsRejectComment.trim()) {
      toast.error("חובה לרשום הערות מנהל");
      return;
    }
    setOpsDeciding(true);
    try {
      const reviewNotes = opsMarkedRooms.map((rowId) => ({
        rowId,
        comment: opsRejectComment.trim(),
      }));
      await approvalsService.decide({
        kind: "measurement_sheet",
        documentId: sheetId,
        decision: "rejected",
        comment: opsRejectComment.trim(),
        reviewNotes: reviewNotes.length ? reviewNotes : undefined,
      });
      const s = await invoicesWorkspaceService.getSheet(sheetId);
      applySheet(s);
      await loadSheets();
      setOpsRejectOpen(false);
      setOpsRejectComment("");
      setOpsMarkedRooms([]);
      toast.success("הדוח הוחזר לתיקון");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setOpsDeciding(false);
    }
  }

  async function handleGenerateInvoice() {
    if (!sheetId) return;
    setGeneratingInvoice(true);
    try {
      const summary = await invoicesWorkspaceService.getSummary(projectId, [
        sheetId,
      ]);
      setInvoicePreview(summary);
      const result = await invoicesWorkspaceService.generateInvoice({
        projectId,
        sheetIds: [sheetId],
        createDocumentFolder: false,
      });
      const inv = result.invoice;
      setInvoiceDraftId(inv.id);
      setAskInvoice(false);
      toast.success("טיוטת חשבון הוכנה");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGeneratingInvoice(false);
    }
  }

  async function handleSaveInvoiceDoc() {
    if (!invoiceDraftId) return;
    setSavingInvoiceDoc(true);
    try {
      await invoiceService.saveDocument(invoiceDraftId);
      toast.success("החשבון נשמר במסמכי הפרויקט (תיקיית חשבונות)");
      setAskSaveInvoiceDoc(false);
      setInvoiceDraftId(null);
      setInvoicePreview(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingInvoiceDoc(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-gray-500">טוען…</p>;
  }

  const matrix = (
    <div
      className={
        fullscreen
          ? "flex h-full min-h-0 flex-col gap-3"
          : "space-y-3"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          value={sheetId ?? ""}
          onChange={(e) => setSheetId(e.target.value)}
          disabled={fullscreen && dirty}
        >
          {sheets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
              {STATUS_UI[s.status]
                ? ` (${STATUS_UI[s.status].label})`
                : ""}
              {s.currentVersion ? ` · V${s.currentVersion}` : ""}
            </option>
          ))}
        </select>
        {!locked && (
          <ProjectRoomsToolbar
            projectId={projectId}
            disabled={!sheetId}
            onChanged={onRoomsChanged}
          />
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => void createSheet()}
          disabled={creating}
        >
          דף מדידה חדש
        </Button>

        <div className="ms-auto flex flex-wrap gap-2">
          {dirty && !locked && (
            <span className="self-center text-xs font-medium text-amber-700">
              {saving ? "שומר ברקע…" : "יש שינויים — יישמר אוטומטית"}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFullscreen((v) => !v)}
          >
            {fullscreen ? (
              <>
                <Minimize2 className="h-4 w-4" />
                יציאה ממסך מלא
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                מסך מלא
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!sheetId}
            onClick={() => openPdf()}
          >
            <FileText className="h-4 w-4" />
            יצוא PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!sheetId || exportingExcel || !sections.length}
            onClick={() => void exportExcel()}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {exportingExcel ? "מייצא…" : "יצוא Excel"}
          </Button>
          {sheet && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                STATUS_UI[sheet.status]?.className || "bg-gray-100 text-gray-700"
              }`}
            >
              {STATUS_UI[sheet.status]?.label || sheet.status}
              {sheet.currentVersion ? ` · V${sheet.currentVersion}` : ""}
            </span>
          )}
          {!locked && (
            <Button
              size="sm"
              onClick={() => void saveAll()}
              disabled={saving || !dirty}
            >
              <Save className="h-4 w-4" />
              {saving ? "שומר…" : "שמור"}
            </Button>
          )}
          {!locked && (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => void openSubmitFlow()}
            >
              <CheckCircle2 className="h-4 w-4" />
              שלח לאישור
            </Button>
          )}
          {isApproved && (
            <Button size="sm" onClick={() => setAskInvoice(true)}>
              הפק חשבון
            </Button>
          )}
          {isPending && (
            <>
              <span className="self-center text-xs font-medium text-amber-700">
                ממתין לאישור מנהל תפעול
              </span>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={opsDeciding}
                onClick={() => void handleOpsApprove()}
              >
                <CheckCircle2 className="h-4 w-4" />
                אשר
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700"
                disabled={opsDeciding}
                onClick={() => {
                  setOpsRejectComment("");
                  setOpsMarkedRooms([]);
                  setOpsRejectOpen(true);
                }}
              >
                <X className="h-4 w-4" />
                החזר לתיקון
              </Button>
            </>
          )}
        </div>
      </div>

      {revisionCount > 0 && !isRevision && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
          יש {revisionCount} דוחות להשלמה (דורשים תיקון)
        </div>
      )}

      {isRevision && (
        <div className="space-y-2">
          <RevisionFeedbackBanner
            comment={
              sheet?.lastReturnComment ||
              sheet?.rejectionComment ||
              "הוחזר לתיקון"
            }
          />
          {!!activeReviewNotes.length && (
            <ul className="list-disc space-y-1 rounded-xl border border-orange-100 bg-orange-50/50 px-4 py-2 pr-8 text-xs text-orange-900">
              {activeReviewNotes.map((n: any) => (
                <li key={n.id}>
                  {n.comment}
                  {n.authorName ? ` — ${n.authorName}` : ""}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-orange-700">
            תקנו את המבוקש ולחצו שוב «שלח לאישור»
          </p>
        </div>
      )}

      {sheet && !fullscreen && (
        <div className="grid gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <InfoMeta label="פרויקט" value={sheet.project?.name} />
          <InfoMeta label="לקוח" value={sheet.project?.contractor} />
          <InfoMeta label="כתובת" value={sheet.project?.location} />
          <InfoMeta
            label="יוצר"
            value={sheet.createdBy?.name || sheet.createdByName}
          />
          <InfoMeta
            label="תאריך"
            value={
              sheet.createdAt
                ? new Date(sheet.createdAt).toLocaleDateString("he-IL")
                : null
            }
          />
          <InfoMeta
            label="סטטוס"
            value={STATUS_UI[sheet.status]?.label || sheet.status}
          />
          <InfoMeta
            label="גרסה"
            value={sheet.currentVersion ? `V${sheet.currentVersion}` : "V1"}
          />
          <InfoMeta
            label="מספר"
            value={sheet.documentNumber || `MS-${sheet.sequenceNumber}`}
          />
        </div>
      )}

      {!!sheet?.versions?.length && (
        <details className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-gray-700">
            היסטוריית גרסאות ({sheet.versions.length})
          </summary>
          <ul className="mt-2 space-y-2 border-t border-gray-100 pt-2">
            {[...sheet.versions]
              .sort((a: any, b: any) => b.version - a.version)
              .map((v: any) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600"
                >
                  <span>
                    <span className="font-bold text-gray-900">V{v.version}</span>
                    {v.note ? ` — ${v.note}` : ""}
                    {v.createdAt
                      ? ` · ${new Date(v.createdAt).toLocaleString("he-IL")}`
                      : ""}
                  </span>
                  <button
                    type="button"
                    className="font-bold text-primary-700"
                    onClick={() => setVersionPreview(v)}
                  >
                    פתח גרסה
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}

      {sheet && !sections.length && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
          <p className="font-bold text-amber-950">
            {ensuringGrid
              ? "מכינים את טבלת המדידה…"
              : "אין עמודות להזנה — חסר כתב כמויות בפרויקט"}
          </p>
          <p className="mt-1 text-sm text-amber-800">
            נצור סעיפי בסיס ונפתח את הטבלה למילוי
          </p>
          <Button
            className="mt-4"
            onClick={() => void ensureFillableGrid()}
            disabled={ensuringGrid || locked}
          >
            {ensuringGrid ? "מכין…" : "הצג טבלה למילוי"}
          </Button>
        </div>
      )}

      {sheet && !!sections.length && !rooms.length && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <p className="text-4xl" aria-hidden>
            📐
          </p>
          <p className="mt-3 text-lg font-bold text-gray-900">
            דף המדידה עדיין ריק
          </p>
          <p className="mt-1 text-sm text-gray-500">
            הוסיפו חדרים והתחילו להזין כמויות
          </p>
          {!locked && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <ProjectRoomsToolbar
                projectId={projectId}
                disabled={!sheetId}
                onChanged={onRoomsChanged}
              />
              <Button onClick={() => void ensureFillableGrid()}>
                <Plus className="h-4 w-4" />
                התחל להזין מדידות
              </Button>
            </div>
          )}
        </div>
      )}

      {sheet && !!sections.length && !!rooms.length && (
        <div
          className={
            fullscreen
              ? "min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 bg-white"
              : "max-h-[70vh] overflow-auto rounded-2xl border border-gray-200 bg-white"
          }
          style={{ contentVisibility: "auto" }}
        >
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-gray-50">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky right-0 z-30 border-b border-l border-gray-200 bg-gray-50 px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap min-w-[150px]"
                >
                  חדר / יחידה
                </th>
                {sections.map((item: any) => (
                  <th
                    key={item.id}
                    className="border-b border-gray-200 px-2 py-2 text-center font-semibold text-gray-700 min-w-[120px] max-w-[160px] align-bottom"
                  >
                    <p className="font-mono text-xs font-bold text-gray-500">
                      {item.code}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-tight text-gray-800">
                      {item.description}
                    </p>
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="border-b border-gray-200 bg-primary-50 px-3 py-3 text-center font-semibold text-gray-700 whitespace-nowrap"
                >
                  סה״כ חדר
                </th>
              </tr>
              <tr>
                {sections.map((item: any) => {
                  const done = sectionTotal(item.id);
                  const remain = sectionRemaining(item);
                  const contract = Number(item.contractQuantity) || 0;
                  return (
                    <th
                      key={`meta-${item.id}`}
                      className="border-b border-gray-200 bg-gray-50/80 px-1 py-1.5 text-center align-top"
                    >
                      <div className="space-y-0.5 text-[10px] leading-tight">
                        <p className="text-gray-500">
                          מאושר{" "}
                          <span className="font-bold text-gray-800">
                            {formatNumber(contract)}
                          </span>
                          {item.unit ? ` ${item.unit}` : ""}
                        </p>
                        <p className="text-gray-500">
                          בוצע{" "}
                          <span className="font-bold text-primary-700">
                            {formatNumber(done)}
                          </span>
                        </p>
                        <p
                          className={cn(
                            "font-bold",
                            remain > 0 ? "text-red-600" : "text-emerald-600"
                          )}
                        >
                          יתרה {formatNumber(remain)}
                        </p>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room: any) => (
                <tr
                  key={room.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50"
                  draggable={!locked && !!room.projectRoomId}
                  onDragStart={() => setDragRoomId(room.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragRoomId) void reorderRoomsByRowIds(dragRoomId, room.id);
                    setDragRoomId(null);
                  }}
                  onDragEnd={() => setDragRoomId(null)}
                >
                  <td className="sticky right-0 z-10 border-l border-gray-100 bg-white px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {!locked && room.projectRoomId && (
                        <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-gray-300" />
                      )}
                      {!locked && room.projectRoomId ? (
                        <input
                          className="min-w-[7rem] rounded-lg border border-transparent bg-transparent px-1 py-0.5 font-semibold text-gray-900 hover:border-gray-200 focus:border-primary-400 focus:outline-none"
                          defaultValue={room.name}
                          onBlur={(e) => {
                            const name = e.target.value.trim();
                            if (!name || name === room.name) return;
                            void invoicesWorkspaceService
                              .updateRoom(projectId, room.projectRoomId, {
                                name,
                              })
                              .then(() => onRoomsChanged())
                              .catch((err: any) =>
                                toast.error(
                                  err?.message || "לא ניתן לעדכן שם חדר"
                                )
                              );
                          }}
                        />
                      ) : (
                        room.name
                      )}
                      {room.floor ? (
                        <span className="text-[10px] font-normal text-gray-400">
                          · קומה {room.floor}
                        </span>
                      ) : null}
                      {activeReviewNotes.some(
                        (n: any) => n.rowId === room.id
                      ) && (
                        <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-800">
                          נדרש תיקון
                        </span>
                      )}
                    </span>
                  </td>
                  {sections.map((item: any) => {
                    const key = cellKey(room.id, item.id);
                    return (
                      <td key={item.id} className="px-1 py-1">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          disabled={locked}
                          className="mx-auto block w-[88px] rounded-lg border border-gray-200 px-2 py-1.5 text-center disabled:bg-gray-50"
                          value={draft[key] ?? "0"}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [key]: e.target.value,
                            }))
                          }
                        />
                      </td>
                    );
                  })}
                  <td className="bg-primary-50/40 px-3 py-2 text-center font-bold text-primary-700">
                    {formatNumber(roomTotal(room.id))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-gray-50">
              <tr>
                <td className="sticky right-0 z-10 border-t border-l border-gray-200 bg-gray-50 px-3 py-2 font-semibold text-gray-700">
                  סה״כ שבוצע
                </td>
                {sections.map((item: any) => {
                  const total = sectionTotal(item.id);
                  return (
                    <td
                      key={`tot-${item.id}`}
                      className="border-t border-gray-200 px-1 py-2 text-center"
                    >
                      <p className="font-bold text-primary-700">
                        {formatNumber(total)}
                      </p>
                    </td>
                  );
                })}
                <td className="border-t border-gray-200 bg-primary-50 px-3 py-2 text-center font-bold text-primary-700">
                  {formatNumber(
                    rooms.reduce(
                      (s: number, u: any) => s + roomTotal(u.id),
                      0
                    )
                  )}
                </td>
              </tr>
              <tr>
                <td className="sticky right-0 z-10 border-t border-l border-gray-200 bg-gray-50 px-3 py-2 font-semibold text-gray-700">
                  יתרה
                </td>
                {sections.map((item: any) => {
                  const remain = sectionRemaining(item);
                  return (
                    <td
                      key={`rem-${item.id}`}
                      className="border-t border-gray-200 px-1 py-2 text-center"
                    >
                      <p
                        className={cn(
                          "text-sm font-bold",
                          remain > 0 ? "text-red-600" : "text-emerald-600"
                        )}
                      >
                        {formatNumber(remain)}
                      </p>
                    </td>
                  );
                })}
                <td className="border-t border-gray-200 bg-primary-50 px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-10">
      {!fullscreen && (
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
              <h2
                className={
                  embedded
                    ? "text-lg font-bold text-gray-900"
                    : "text-xl font-bold text-gray-900"
                }
              >
                דפי מדידה
              </h2>
              <p className="text-sm text-gray-500">
                שורות = חדרים · עמודות = סעיפים · עבודה כמו באקסל
              </p>
            </div>
          </div>
        </div>
      )}

      {!sheets.length ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <p className="text-4xl" aria-hidden>
            📐
          </p>
          <p className="mt-3 text-lg font-bold text-gray-900">
            דף המדידה עדיין ריק
          </p>
          <p className="mt-1 text-sm text-gray-500">
            צרו דף מדידה והתחילו להזין כמויות לפי חדרים וסעיפים
          </p>
          <Button
            className="mt-5"
            onClick={() => void createSheet()}
            disabled={creating}
          >
            <Plus className="h-4 w-4" />
            {creating ? "יוצר…" : "התחל להזין מדידות"}
          </Button>
        </div>
      ) : fullscreen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <p className="font-bold text-gray-900">
              {sheet?.title || "דף מדידה"} — מסך מלא
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFullscreen(false)}
            >
              <Minimize2 className="h-4 w-4" />
              יציאה ממסך מלא
            </Button>
          </div>
          <div className="min-h-0 flex-1">{matrix}</div>
        </div>
      ) : (
        matrix
      )}

      <Modal
        open={submitApproverOpen}
        onClose={() => setSubmitApproverOpen(false)}
        title="שלח לאישור"
        description="בחרו מנהל תפעול, מנהל פרויקט או מנהל עבודה לאישור דוח הביצוע"
        size="lg"
      >
        <div className="space-y-4">
          {loadingApprovers ? (
            <p className="text-sm text-gray-500">טוען מאשרים…</p>
          ) : (
            <div className="max-h-64 space-y-1 overflow-auto rounded-xl border border-gray-200 p-2">
              {approvers.map((a) => {
                const checked = selectedApproverIds.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                      checked ? "bg-primary-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedApproverIds((prev) =>
                          prev.includes(a.id)
                            ? prev.filter((x) => x !== a.id)
                            : [...prev, a.id]
                        )
                      }
                    />
                    <span className="flex-1 font-medium">{a.fullName}</span>
                    <span className="text-xs text-gray-500">{a.roleLabel}</span>
                  </label>
                );
              })}
              {!approvers.length && (
                <p className="p-3 text-center text-sm text-gray-400">
                  לא נמצאו מאשרים
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <Button
              variant="outline"
              onClick={() => setSubmitApproverOpen(false)}
              disabled={completing}
            >
              ביטול
            </Button>
            <Button
              onClick={() => void handleSubmitForApproval()}
              disabled={completing || !selectedApproverIds.length}
              loading={completing}
            >
              שלח לאישור
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={opsRejectOpen}
        onClose={() => setOpsRejectOpen(false)}
        title="הערות מנהל — החזרה לתיקון"
        description="הדוח לא יימחק. מנהל העבודה יראה את ההערות ויתקן."
        size="lg"
      >
        <div className="space-y-4">
          <textarea
            className="min-h-28 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            placeholder="לדוגמה: חדר 4 · סעיף 12 · חסרה תמונה / כמות לא תואמת"
            value={opsRejectComment}
            onChange={(e) => setOpsRejectComment(e.target.value)}
          />
          {!!rooms.length && (
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-600">
                סמנו חדרים שדורשים תיקון (אופציונלי)
              </p>
              <div className="max-h-40 space-y-1 overflow-auto rounded-xl border border-gray-200 p-2">
                {rooms.map((room: any) => {
                  const checked = opsMarkedRooms.includes(room.id);
                  return (
                    <label
                      key={room.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                        checked ? "bg-orange-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setOpsMarkedRooms((prev) =>
                            prev.includes(room.id)
                              ? prev.filter((id) => id !== room.id)
                              : [...prev, room.id]
                          )
                        }
                      />
                      {room.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <Button
              variant="outline"
              onClick={() => setOpsRejectOpen(false)}
              disabled={opsDeciding}
            >
              ביטול
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleOpsReject()}
              disabled={opsDeciding || !opsRejectComment.trim()}
              loading={opsDeciding}
            >
              שלח חזרה למנהל העבודה
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationDialog
        open={askInvoice}
        onClose={() => setAskInvoice(false)}
        onConfirm={() => void handleGenerateInvoice()}
        title="הפקת חשבון"
        description="הדוח אושר. האם להפיק ממנו חשבון?"
        confirmLabel="כן"
        cancelLabel="לא"
        loading={generatingInvoice}
        loadingLabel="מכין חשבון…"
        variant="primary"
      />

      <Modal
        open={Boolean(invoiceDraftId) && !approverOpen && !askSaveInvoiceDoc}
        onClose={() => {
          setInvoiceDraftId(null);
          setInvoicePreview(null);
        }}
        title="טיוטת חשבון"
        description="הנתונים נלקחו מדף המדידה. לאחר אישור — בחרו מנהלים לשליחה."
        size="lg"
      >
        <div className="space-y-4">
          {invoicePreview?.billableLines?.length ? (
            <div className="overflow-auto rounded-xl border border-gray-200 max-h-64">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-right">סעיף</th>
                    <th className="px-3 py-2 text-right">כמות לחיוב</th>
                    <th className="px-3 py-2 text-right">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicePreview.billableLines.map((l: any) => (
                    <tr key={l.boqItemId} className="border-t border-gray-50">
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-gray-400">
                          {l.code}
                        </span>{" "}
                        {l.description}
                      </td>
                      <td className="px-3 py-2">
                        {formatNumber(l.billableQuantity)}
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {formatNumber(l.amount ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">טיוטת החשבון נוצרה בהצלחה.</p>
          )}
          {invoicePreview?.subtotal != null && (
            <p className="text-sm font-bold text-gray-900">
              סה״כ: {formatNumber(invoicePreview.subtotal)}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <Button
              variant="outline"
              onClick={() => {
                setInvoiceDraftId(null);
                setInvoicePreview(null);
              }}
            >
              סגור
            </Button>
            <Button onClick={() => setApproverOpen(true)}>
              בחירת מנהלים לשליחה
            </Button>
          </div>
        </div>
      </Modal>

      {invoiceDraftId && (
        <SendInvoiceApprovalModal
          open={approverOpen}
          onClose={() => setApproverOpen(false)}
          invoiceId={invoiceDraftId}
          onSent={() => {
            toast.success("החשבון נשלח לאישור המנהלים");
            setApproverOpen(false);
            setAskSaveInvoiceDoc(true);
          }}
          onError={(m) => toast.error(m)}
        />
      )}

      <ConfirmationDialog
        open={askSaveInvoiceDoc}
        onClose={() => {
          setAskSaveInvoiceDoc(false);
          setInvoiceDraftId(null);
          setInvoicePreview(null);
        }}
        onConfirm={() => void handleSaveInvoiceDoc()}
        title="שמירה במסמכים"
        description="האם לשמור גם את החשבון במסמכי הפרויקט? (PDF בתיקיית חשבונות)"
        confirmLabel="כן"
        cancelLabel="לא"
        loading={savingInvoiceDoc}
        loadingLabel="שומר…"
        variant="primary"
      />

      <Modal
        open={!!versionPreview}
        onClose={() => setVersionPreview(null)}
        title={
          versionPreview
            ? `גרסה V${versionPreview.version}`
            : "גרסה"
        }
      >
        {versionPreview && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">
              {versionPreview.note || "ללא הערה"}
            </p>
            <p className="text-xs text-gray-400">
              {versionPreview.createdAt
                ? new Date(versionPreview.createdAt).toLocaleString("he-IL")
                : ""}
              {versionPreview.status
                ? ` · ${STATUS_UI[versionPreview.status]?.label || versionPreview.status}`
                : ""}
            </p>
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              הצפייה בגרסה קודמת פותחת את דף ההדפסה של המסמך הנוכחי. עריכת
              גרסאות קודמות אינה זמינה — ניתן לייצא PDF מהמצב הנוכחי.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  openPdf();
                  setVersionPreview(null);
                }}
              >
                <FileText className="h-4 w-4" />
                פתח PDF
              </Button>
              <Button variant="outline" onClick={() => setVersionPreview(null)}>
                סגור
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function InfoMeta({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <p>
      <span className="text-gray-400">{label}: </span>
      <span className="font-semibold text-gray-900">{value || "—"}</span>
    </p>
  );
}
