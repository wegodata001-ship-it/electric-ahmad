/**
 * Internal domain event bus — infrastructure only.
 * Future: wire handlers for Push / WhatsApp / Email / In-App notifications.
 * Do NOT send real notifications from here yet.
 */

export type DomainEventName =
  | "invoice.sent_for_foreman_approval"
  | "invoice.approved_by_foreman"
  | "invoice.rejected_by_foreman"
  | "invoice.sent_to_client"
  | "employee.system_user_requested";

export type DomainEventPayload = {
  invoiceId?: string;
  projectId?: string;
  employeeId?: string;
  approvalId?: string;
  managerId?: string;
  sequenceNumber?: number;
  amount?: number;
  comment?: string | null;
  actorUserId?: string;
};

export type DomainEvent = {
  name: DomainEventName;
  payload: DomainEventPayload;
  occurredAt: string;
};

type DomainEventListener = (event: DomainEvent) => void | Promise<void>;

const listeners = new Set<DomainEventListener>();

export function onDomainEvent(listener: DomainEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Emits an internal event. Currently logs only — no external channels.
 */
export function emitDomainEvent(
  name: DomainEventName,
  payload: DomainEventPayload
): DomainEvent {
  const event: DomainEvent = {
    name,
    payload,
    occurredAt: new Date().toISOString(),
  };

  if (process.env.NODE_ENV !== "production") {
    console.info("[DomainEvent]", event.name, event.payload);
  }

  for (const listener of listeners) {
    try {
      void Promise.resolve(listener(event)).catch((err) => {
        console.error("[DomainEvent] listener failed", event.name, err);
      });
    } catch (err) {
      console.error("[DomainEvent] listener failed", event.name, err);
    }
  }

  return event;
}
