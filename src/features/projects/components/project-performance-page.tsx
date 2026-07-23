"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  GripVertical,
  Maximize2,
  Minimize2,
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
import { approvalsService } from "@/features/work-diaries/services/work-diaries.service";
import { boqService } from "@/features/boq/services/boq.service";
import { ProjectRoomsToolbar } from "@/features/projects/components/project-rooms-toolbar";
import type { BoqItem } from "@/types";

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

  async function loadSheets() {
    const r = await invoicesWorkspaceService.listSheets(projectId);
    setSheets(r.items);
    const fromUrl = searchParams.get("sheetId");
    if (fromUrl && r.items.some((s: any) => s.id === fromUrl)) {
      setSheetId(fromUrl);
    } else if (!sheetId && r.items[0]) {
      setSheetId(r.items[0].id);
    }
    return r.items;
  }

  function applySheet(s: any) {
    setSheet(s);
    const next: DraftMap = {};
    for (const c of s.cells ?? []) {
      next[`${c.rowId}:${c.boqItemId}`] = String(c.quantity ?? 0);
    }
    setDraft(next);
    setSaved(next);
  }

  useEffect(() => {
    Promise.all([loadSheets(), boqService.getByProject(projectId)])
      .then(([, items]) => setBoq(items))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!sheetId) {
      setSheet(null);
      return;
    }
    invoicesWorkspaceService
      .getSheet(sheetId)
      .then(applySheet)
      .catch((e) => toast.error(e.message));
  }, [sheetId, toast]);

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
    const fromSheet = new Map<string, any>();
    for (const c of sheet?.cells ?? []) {
      if (c.boqItem) fromSheet.set(c.boqItemId, c.boqItem);
    }
    if (boq.length) return boq;
    return [...fromSheet.values()].sort((a, b) =>
      String(a.code).localeCompare(String(b.code), "he")
    );
  }, [boq, sheet]);

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

  async function saveAll(): Promise<boolean> {
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
      toast.success("אין שינויים לשמירה");
      return true;
    }
    setSaving(true);
    try {
      const result = await invoicesWorkspaceService.saveCells(sheetId, cells);
      if (result.sheet) applySheet(result.sheet);
      else {
        const next = { ...draft };
        for (const c of cells) {
          next[cellKey(c.rowId, c.boqItemId)] = String(c.quantity);
        }
        setDraft(next);
        setSaved(next);
      }
      toast.success("הנתונים נשמרו");
      return true;
    } catch (e: any) {
      toast.error(e.message);
      return false;
    } finally {
      setSaving(false);
    }
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
      setApprovers(await invoiceService.listApprovers());
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
              יש שינויים שלא נשמרו
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
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <p className="font-bold">דורש תיקון</p>
          {sheet?.lastReturnComment && (
            <p className="mt-1 whitespace-pre-wrap">{sheet.lastReturnComment}</p>
          )}
          {!!activeReviewNotes.length && (
            <ul className="mt-2 list-disc space-y-1 pr-5 text-xs">
              {activeReviewNotes.map((n: any) => (
                <li key={n.id}>
                  {n.comment}
                  {n.authorName ? ` — ${n.authorName}` : ""}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-orange-700">
            תקנו את המבוקש ולחצו שוב «שלח לאישור»
          </p>
        </div>
      )}

      {!!sheet?.versions?.length && (
        <details className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-gray-700">
            היסטוריית גרסאות ({sheet.versions.length})
          </summary>
          <ul className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs text-gray-600">
            {[...sheet.versions]
              .sort((a: any, b: any) => b.version - a.version)
              .map((v: any) => (
                <li key={v.id}>
                  V{v.version}
                  {v.note ? ` — ${v.note}` : ""}
                  {v.createdAt
                    ? ` · ${new Date(v.createdAt).toLocaleString("he-IL")}`
                    : ""}
                </li>
              ))}
          </ul>
        </details>
      )}

      {sheet && (
        <div
          className={
            fullscreen
              ? "min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 bg-white"
              : "max-h-[70vh] overflow-auto rounded-2xl border border-gray-200 bg-white"
          }
        >
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-gray-50">
              <tr>
                <th className="sticky right-0 z-30 border-b border-l border-gray-200 bg-gray-50 px-3 py-3 text-right font-semibold text-gray-700 whitespace-nowrap min-w-[140px]">
                  חדר / יחידה
                </th>
                {sections.map((item: any) => (
                  <th
                    key={item.id}
                    className="border-b border-gray-200 px-2 py-2 text-center font-semibold text-gray-600 min-w-[100px] max-w-[140px] align-bottom"
                  >
                    <p className="font-mono text-[10px] text-gray-400">
                      {item.code}
                    </p>
                    <p className="line-clamp-2 text-xs leading-tight">
                      {item.description}
                    </p>
                    <p className="mt-0.5 text-[10px] font-normal text-gray-400">
                      {formatNumber(Number(item.contractQuantity) || 0)}{" "}
                      {item.unit}
                    </p>
                  </th>
                ))}
                <th className="border-b border-gray-200 bg-primary-50 px-3 py-3 text-center font-semibold text-gray-700 whitespace-nowrap">
                  סה״כ חדר
                </th>
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
                      {room.name}
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
                  סה״כ סעיף
                </td>
                {sections.map((item: any) => {
                  const total = sectionTotal(item.id);
                  const contract = Number(item.contractQuantity) || 0;
                  const remain = Math.max(0, contract - total);
                  return (
                    <td
                      key={item.id}
                      className="border-t border-gray-200 px-1 py-2 text-center"
                    >
                      <p className="font-bold text-primary-700">
                        {formatNumber(total)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        יתרה {formatNumber(remain)}
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
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="mb-4 text-gray-600">עדיין אין דף מדידה לפרויקט</p>
          <Button onClick={() => void createSheet()} disabled={creating}>
            <Plus className="h-4 w-4" />
            {creating ? "יוצר…" : "צור דף מדידה ראשון"}
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
        title="שלח לאישור מנהל תפעול"
        description="בחרו מנהל אחד או יותר לאישור דוח הביצוע"
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
    </div>
  );
}
