import { STATUS_LABELS, type WorkOrderStatus } from "../types";

export function WmStatusBadge({ status }: { status: WorkOrderStatus }) {
  return (
    <span className={`wm-badge wm-badge--${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
