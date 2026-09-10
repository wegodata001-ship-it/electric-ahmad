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
      return "bg-slate-100 text-[#64748B]";
    case "pending_approval":
    case "sent_to_client":
      return "bg-[#FFF7ED] text-[#EA580C]";
    case "approved":
      return "bg-[#ECFDF5] text-[#059669]";
    case "signed":
    case "closed":
      return "bg-[#ECFDF5] text-[#059669]";
    case "revision":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-[#64748B]";
  }
}
