import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import { getWorkflowDefinition } from "./definitions";
import type {
  WorkflowAction,
  WorkflowActor,
  WorkflowDocKind,
  WorkflowStatus,
  WorkflowTransition,
} from "./types";
import { WORKFLOW_STATUS_LABELS } from "./types";

export class WorkflowTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowTransitionError";
  }
}

export function isEditableStatus(kind: WorkflowDocKind, status: WorkflowStatus): boolean {
  return getWorkflowDefinition(kind).editableStatuses.includes(status);
}

export function getNextStepLabel(
  kind: WorkflowDocKind,
  status: WorkflowStatus
): string | null {
  const def = getWorkflowDefinition(kind);
  const next = def.transitions.find((t) => t.from === status);
  if (!next) return null;
  return WORKFLOW_STATUS_LABELS[next.to] ?? next.to;
}

export function findTransition(
  kind: WorkflowDocKind,
  from: WorkflowStatus,
  action: WorkflowAction
): WorkflowTransition | null {
  const def = getWorkflowDefinition(kind);
  return (
    def.transitions.find((t) => t.from === from && t.action === action) ?? null
  );
}

export function listAllowedActions(
  kind: WorkflowDocKind,
  status: WorkflowStatus
): WorkflowAction[] {
  const def = getWorkflowDefinition(kind);
  return def.transitions.filter((t) => t.from === status).map((t) => t.action);
}

/**
 * מאמת מעבר סטטוס רגיל (ללא עקיפה).
 * זורק WorkflowTransitionError אם לא חוקי.
 */
export function assertTransition(input: {
  kind: WorkflowDocKind;
  from: WorkflowStatus;
  action: WorkflowAction;
  actor: WorkflowActor;
  comment?: string | null;
  approverIds?: string[];
}): WorkflowTransition {
  const transition = findTransition(input.kind, input.from, input.action);
  if (!transition) {
    throw new WorkflowTransitionError(
      `מעבר לא מותר: ${input.from} → ${input.action} (${input.kind})`
    );
  }

  if (transition.systemManagerOnly && !isSystemAdminRole(input.actor.role)) {
    throw new WorkflowTransitionError("פעולה זו מותרת למנהל מערכת בלבד");
  }

  if (transition.requiresComment && !input.comment?.trim()) {
    throw new WorkflowTransitionError("חובה לרשום הערות להחזרה לתיקון");
  }

  if (
    transition.requiresApprovers &&
    !(input.approverIds && input.approverIds.length > 0)
  ) {
    throw new WorkflowTransitionError("יש לבחור לפחות מאשר אחד");
  }

  return transition;
}

/**
 * האם מותר ליצור מדידה מיומן — לפי שערי חתימת לקוח.
 */
export function canCreateMeasurementFromDiary(input: {
  diaryStatus: WorkflowStatus;
  clientSignatureStatus: string;
  actorRole: string;
  override?: boolean;
}): { ok: boolean; reason?: string } {
  if (input.override) {
    if (!isSystemAdminRole(input.actorRole)) {
      return { ok: false, reason: "עקיפה מותרת למנהל מערכת בלבד" };
    }
    return { ok: true };
  }

  if (
    input.diaryStatus !== "client_signed" &&
    input.diaryStatus !== "used_for_measurement" &&
    input.diaryStatus !== "used_for_account" &&
    input.diaryStatus !== "used_for_invoice" &&
    input.diaryStatus !== "locked"
  ) {
    return {
      ok: false,
      reason: "ניתן ליצור מדידה רק לאחר חתימת לקוח על יומן העבודה",
    };
  }

  if (input.clientSignatureStatus !== "signed") {
    return { ok: false, reason: "חתימת לקוח חסרה" };
  }

  return { ok: true };
}
