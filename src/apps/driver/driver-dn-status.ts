import { SIGNED_STATUS_LABEL } from "@/lib/signatures";

export const DRIVER_DN_STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  pending_approval: "נשלח לאישור",
  approved: "מאושר",
  sent_to_client: "נשלח ללקוח",
  signed: SIGNED_STATUS_LABEL,
  revision: "נדחה",
  closed: SIGNED_STATUS_LABEL,
};

export function driverDnStatusTone(status: string): string {
  switch (status) {
    case "draft":
      return "bg-slate-100 text-slate-700";
    case "pending_approval":
    case "sent_to_client":
      return "bg-amber-100 text-amber-900";
    case "approved":
      return "bg-emerald-100 text-emerald-800";
    case "signed":
    case "closed":
      return "bg-emerald-100 text-emerald-900";
    case "revision":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
