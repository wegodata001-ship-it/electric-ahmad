/**
 * FUTURE Manager Workspace navigation — preparation only.
 *
 * Do NOT wire this into the office layout / sidebar yet.
 * When the foreman system is built, mount this under a dedicated manager shell
 * (e.g. `/manager/*`) with separate auth — without changing office navigation.
 */
import {
  BarChart3,
  ClipboardList,
  FileText,
  Image,
  LayoutDashboard,
  Receipt,
  Settings,
  Briefcase,
} from "lucide-react";

export const MANAGER_WORKSPACE_BASE = "/manager";

export const managerNavigation = [
  {
    name: "Dashboard",
    href: `${MANAGER_WORKSPACE_BASE}/dashboard`,
    icon: LayoutDashboard,
  },
  {
    name: "העבודות שלי",
    href: `${MANAGER_WORKSPACE_BASE}/jobs`,
    icon: Briefcase,
  },
  {
    name: "כתב כמויות",
    href: `${MANAGER_WORKSPACE_BASE}/boq`,
    icon: ClipboardList,
  },
  {
    name: "דיווחי ביצוע",
    href: `${MANAGER_WORKSPACE_BASE}/reports`,
    icon: BarChart3,
  },
  {
    name: "חשבונות לאישור",
    href: `${MANAGER_WORKSPACE_BASE}/invoices-for-approval`,
    icon: Receipt,
    highlight: true,
  },
  {
    name: "מסמכים",
    href: `${MANAGER_WORKSPACE_BASE}/documents`,
    icon: FileText,
  },
  {
    name: "תמונות",
    href: `${MANAGER_WORKSPACE_BASE}/photos`,
    icon: Image,
  },
  {
    name: "גלריה",
    href: `${MANAGER_WORKSPACE_BASE}/gallery`,
    icon: Image,
  },
  {
    name: "הגדרות",
    href: `${MANAGER_WORKSPACE_BASE}/settings`,
    icon: Settings,
  },
] as const;

/** Columns planned for future "חשבונות לאישור" screen */
export const MANAGER_INVOICE_APPROVAL_COLUMNS = [
  "מספר חשבון",
  "שם הפרויקט",
  "תאריך",
  "סכום",
  "אחוז ביצוע",
  "מספר סעיפים",
  "סטטוס",
] as const;

/**
 * Fields a foreman may see when reviewing an invoice (no internal company finance).
 */
export const MANAGER_INVOICE_REVIEW_FIELDS = [
  "items_included",
  "executed_quantities",
  "quantities_to_invoice",
  "supporting_photos_and_reports",
  "notes",
] as const;
