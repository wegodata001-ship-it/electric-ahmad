import { isSystemAdminRole } from "@/lib/auth/document-permissions";
import type { WorkflowActor, WorkflowStatus } from "./types";
import { WorkflowTransitionError } from "./status-engine";

export type OverrideRequest = {
  actor: WorkflowActor;
  fromStatus: WorkflowStatus;
  toStatus: WorkflowStatus;
  reason: string;
  note: string;
};

/**
 * עקיפת Workflow — System Manager בלבד + Reason + הערה מפורטת.
 */
export function assertOverrideAllowed(req: OverrideRequest): void {
  if (!isSystemAdminRole(req.actor.role)) {
    throw new WorkflowTransitionError("עקיפת Workflow מותרת למנהל מערכת בלבד");
  }
  if (!req.reason.trim()) {
    throw new WorkflowTransitionError("חובה לציין סיבת עקיפה");
  }
  if (!req.note.trim() || req.note.trim().length < 5) {
    throw new WorkflowTransitionError("חובה לרשום הערה מפורטת לעקיפה");
  }
  if (req.fromStatus === req.toStatus) {
    throw new WorkflowTransitionError("סטטוס היעד זהה לסטטוס הנוכחי");
  }
}
