import { STATUS_LABELS, STATUS_STEPS, type WorkOrderStatus } from "../types";

export function WmWorkflowStepper({ status }: { status: WorkOrderStatus }) {
  if (status === "cancelled") {
    return (
      <div className="wm-workflow-stepper">
        <div className="wm-workflow-step active">
          <div className="wm-workflow-dot">✕</div>
          <div className="wm-workflow-label">בוטל</div>
        </div>
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(status);

  return (
    <div className="wm-workflow-stepper">
      {STATUS_STEPS.map((step, idx) => {
        const cls =
          idx < currentIdx ? "done" : idx === currentIdx ? "active" : "";
        return (
          <div key={step} className={`wm-workflow-step ${cls}`}>
            <div className="wm-workflow-dot">{idx + 1}</div>
            <div className="wm-workflow-label">{STATUS_LABELS[step]}</div>
          </div>
        );
      })}
    </div>
  );
}
