import type { WorkflowDefinition, WorkflowDocKind } from "./types";

const DIARY_TRANSITIONS: WorkflowDefinition["transitions"] = [
  { from: "draft", action: "submit", to: "pending_approval", requiresApprovers: true },
  { from: "revision", action: "resubmit", to: "pending_approval", requiresApprovers: true },
  { from: "pending_approval", action: "approve", to: "approved" },
  {
    from: "pending_approval",
    action: "reject",
    to: "revision",
    requiresComment: true,
  },
  { from: "approved", action: "send_to_client", to: "sent_to_client" },
  { from: "sent_to_client", action: "client_signed", to: "client_signed" },
  {
    from: "client_signed",
    action: "mark_used_measurement",
    to: "used_for_measurement",
  },
  {
    from: "used_for_measurement",
    action: "mark_used_account",
    to: "used_for_account",
  },
  {
    from: "used_for_account",
    action: "mark_used_invoice",
    to: "used_for_invoice",
  },
  { from: "used_for_invoice", action: "lock", to: "locked" },
  { from: "draft", action: "cancel", to: "cancelled" },
  { from: "revision", action: "cancel", to: "cancelled" },
];

const DELIVERY_TRANSITIONS: WorkflowDefinition["transitions"] = [
  { from: "draft", action: "submit", to: "pending_approval", requiresApprovers: true },
  { from: "revision", action: "resubmit", to: "pending_approval", requiresApprovers: true },
  { from: "pending_approval", action: "approve", to: "approved" },
  {
    from: "pending_approval",
    action: "reject",
    to: "revision",
    requiresComment: true,
  },
  { from: "approved", action: "send_to_receiver", to: "sent_to_receiver" },
  { from: "sent_to_receiver", action: "receiver_signed", to: "receiver_signed" },
  { from: "receiver_signed", action: "lock", to: "locked" },
  { from: "draft", action: "cancel", to: "cancelled" },
];

const EXECUTION_TRANSITIONS: WorkflowDefinition["transitions"] = [
  { from: "draft", action: "submit", to: "pending_approval", requiresApprovers: true },
  { from: "revision", action: "resubmit", to: "pending_approval", requiresApprovers: true },
  { from: "pending_approval", action: "approve", to: "approved" },
  {
    from: "pending_approval",
    action: "reject",
    to: "revision",
    requiresComment: true,
  },
  { from: "approved", action: "send_to_client", to: "sent_to_client" },
  { from: "sent_to_client", action: "client_signed", to: "client_signed" },
  { from: "client_signed", action: "lock", to: "locked" },
  { from: "draft", action: "cancel", to: "cancelled" },
];

const MEASUREMENT_TRANSITIONS: WorkflowDefinition["transitions"] = [
  { from: "draft", action: "submit", to: "pending_approval", requiresApprovers: true },
  { from: "revision", action: "resubmit", to: "pending_approval", requiresApprovers: true },
  { from: "pending_approval", action: "approve", to: "approved" },
  {
    from: "pending_approval",
    action: "reject",
    to: "revision",
    requiresComment: true,
  },
  { from: "approved", action: "send_to_client", to: "sent_to_client" },
  { from: "sent_to_client", action: "client_signed", to: "client_signed" },
  { from: "client_signed", action: "lock", to: "locked" },
  { from: "approved", action: "lock", to: "locked" },
  { from: "draft", action: "cancel", to: "cancelled" },
];

const ACCOUNT_TRANSITIONS: WorkflowDefinition["transitions"] = [
  { from: "draft", action: "submit", to: "pending_approval", requiresApprovers: true },
  { from: "revision", action: "resubmit", to: "pending_approval", requiresApprovers: true },
  { from: "pending_approval", action: "approve", to: "approved" },
  {
    from: "pending_approval",
    action: "reject",
    to: "revision",
    requiresComment: true,
  },
  { from: "approved", action: "lock", to: "locked" },
  { from: "draft", action: "cancel", to: "cancelled" },
];

const INVOICE_TRANSITIONS: WorkflowDefinition["transitions"] = [
  { from: "draft", action: "submit", to: "pending_approval", requiresApprovers: true },
  { from: "pending_approval", action: "approve", to: "approved" },
  {
    from: "pending_approval",
    action: "reject",
    to: "revision",
    requiresComment: true,
  },
  { from: "approved", action: "lock", to: "locked" },
];

const SCHEDULE_TRANSITIONS: WorkflowDefinition["transitions"] = [
  { from: "draft", action: "submit", to: "pending_approval" },
  { from: "pending_approval", action: "approve", to: "approved" },
  { from: "approved", action: "lock", to: "locked" },
  { from: "draft", action: "cancel", to: "cancelled" },
];

export const WORKFLOW_DEFINITIONS: Record<WorkflowDocKind, WorkflowDefinition> = {
  WORK_DIARY: {
    kind: "WORK_DIARY",
    labelHe: "יומן עבודה",
    numberPrefix: "WD",
    initialStatus: "draft",
    editableStatuses: ["draft", "revision"],
    transitions: DIARY_TRANSITIONS,
    gateMeasurementOnClientSignature: true,
    approvalMode: "any_one",
  },
  DELIVERY_NOTE: {
    kind: "DELIVERY_NOTE",
    labelHe: "תעודת משלוח",
    numberPrefix: "DN",
    initialStatus: "draft",
    editableStatuses: ["draft", "revision"],
    transitions: DELIVERY_TRANSITIONS,
    gateMeasurementOnClientSignature: false,
    approvalMode: "any_one",
  },
  EXECUTION_REPORT: {
    kind: "EXECUTION_REPORT",
    labelHe: "דוח ביצוע",
    numberPrefix: "ER",
    initialStatus: "draft",
    editableStatuses: ["draft", "revision"],
    transitions: EXECUTION_TRANSITIONS,
    gateMeasurementOnClientSignature: true,
    approvalMode: "any_one",
  },
  MEASUREMENT: {
    kind: "MEASUREMENT",
    labelHe: "מדידה",
    numberPrefix: "MS",
    initialStatus: "draft",
    editableStatuses: ["draft", "revision"],
    transitions: MEASUREMENT_TRANSITIONS,
    gateMeasurementOnClientSignature: false,
    approvalMode: "any_one",
  },
  ACCOUNT: {
    kind: "ACCOUNT",
    labelHe: "חשבון",
    numberPrefix: "AC",
    initialStatus: "draft",
    editableStatuses: ["draft", "revision"],
    transitions: ACCOUNT_TRANSITIONS,
    gateMeasurementOnClientSignature: false,
    approvalMode: "any_one",
  },
  INVOICE: {
    kind: "INVOICE",
    labelHe: "חשבונית",
    numberPrefix: "IN",
    initialStatus: "draft",
    editableStatuses: ["draft", "revision"],
    transitions: INVOICE_TRANSITIONS,
    gateMeasurementOnClientSignature: false,
    approvalMode: "any_one",
  },
  WORK_SCHEDULE: {
    kind: "WORK_SCHEDULE",
    labelHe: "סידור עבודה",
    numberPrefix: "WS",
    initialStatus: "draft",
    editableStatuses: ["draft"],
    transitions: SCHEDULE_TRANSITIONS,
    gateMeasurementOnClientSignature: false,
    approvalMode: "any_one",
  },
  GENERAL: {
    kind: "GENERAL",
    labelHe: "מסמך כללי",
    numberPrefix: "GD",
    initialStatus: "draft",
    editableStatuses: ["draft", "revision"],
    transitions: [
      { from: "draft", action: "submit", to: "pending_approval", requiresApprovers: true },
      { from: "pending_approval", action: "approve", to: "approved" },
      {
        from: "pending_approval",
        action: "reject",
        to: "revision",
        requiresComment: true,
      },
      { from: "revision", action: "resubmit", to: "pending_approval", requiresApprovers: true },
      { from: "approved", action: "lock", to: "locked" },
    ],
    gateMeasurementOnClientSignature: false,
    approvalMode: "any_one",
  },
};

export function getWorkflowDefinition(kind: WorkflowDocKind): WorkflowDefinition {
  const def = WORKFLOW_DEFINITIONS[kind];
  if (!def) throw new Error(`סוג מסמך לא מוכר במנוע Workflow: ${kind}`);
  return def;
}
