/**
 * Central Workflow Engine — types & shared contracts (Stage 1)
 */

export type WorkflowDocKind =
  | "WORK_DIARY"
  | "DELIVERY_NOTE"
  | "EXECUTION_REPORT"
  | "MEASUREMENT"
  | "ACCOUNT"
  | "INVOICE"
  | "WORK_SCHEDULE"
  | "GENERAL";

export type WorkflowStatus =
  | "draft"
  | "pending_approval"
  | "revision"
  | "approved"
  | "sent_to_client"
  | "client_signed"
  | "sent_to_receiver"
  | "receiver_signed"
  | "used_for_measurement"
  | "used_for_account"
  | "used_for_invoice"
  | "locked"
  | "cancelled";

export type ClientSignatureStatus =
  | "none"
  | "pending"
  | "opened"
  | "signed"
  | "expired";

export type WorkflowAction =
  | "submit"
  | "approve"
  | "reject"
  | "resubmit"
  | "send_to_client"
  | "client_signed"
  | "send_to_receiver"
  | "receiver_signed"
  | "mark_used_measurement"
  | "mark_used_account"
  | "mark_used_invoice"
  | "lock"
  | "cancel"
  | "override";

export type WorkflowTransition = {
  from: WorkflowStatus;
  action: WorkflowAction;
  to: WorkflowStatus;
  /** דורש מאשרים */
  requiresApprovers?: boolean;
  /** דורש הערת מנהל */
  requiresComment?: boolean;
  /** דורש חתימת לקוח קודם (או עקיפה) */
  requiresClientSigned?: boolean;
  /** רק System Manager */
  systemManagerOnly?: boolean;
};

export type WorkflowDefinition = {
  kind: WorkflowDocKind;
  labelHe: string;
  numberPrefix: string;
  initialStatus: WorkflowStatus;
  editableStatuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
  /** האם נדרשת חתימת לקוח לפני מדידה/חשבון */
  gateMeasurementOnClientSignature: boolean;
  /**
   * any_one — אישור אחד מספיק; שאר הבקשות נסגרות.
   * all_must — כל המאשרים חייבים לאשר (למסלולים עתידיים).
   */
  approvalMode: "any_one" | "all_must";
};

export type WorkflowActor = {
  userId: string;
  role: string;
  name?: string;
};

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  draft: "טיוטה",
  pending_approval: "ממתין לאישור",
  revision: "דורש תיקון",
  approved: "אושר",
  sent_to_client: "נשלח ללקוח",
  client_signed: "נחתם ע״י לקוח",
  sent_to_receiver: "נשלח למקבל",
  receiver_signed: "נחתם ע״י מקבל",
  used_for_measurement: "שימש למדידה",
  used_for_account: "שימש לחשבון",
  used_for_invoice: "שימש לחשבונית",
  locked: "נעול",
  cancelled: "בוטל",
};
