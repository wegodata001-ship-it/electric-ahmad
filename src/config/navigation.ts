import {
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  HardHat,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Users,
} from "lucide-react";

/**
 * Office sidebar — ordered by real company workflow:
 * Dashboard → Approvals → Delivery notes → Projects → …
 */
export const mainNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "ממתינים לאישור", href: "/approvals", icon: ClipboardCheck },
  { name: "תעודות משלוח", href: "/delivery-notes", icon: Package },
  { name: "מרכז מסמכים", href: "/documents-archive", icon: ClipboardList },
  { name: "פרויקטים", href: "/projects", icon: Building2 },
  { name: "כתבי כמויות", href: "/boq", icon: ClipboardList },
  { name: "חשבונות", href: "/invoices", icon: Receipt },
  { name: "מנהלי עבודה", href: "/foremen", icon: HardHat },
  { name: "עובדים", href: "/employees", icon: Users },
  { name: "דיווחים", href: "/reports", icon: BarChart3 },
  { name: "הגדרות", href: "/settings", icon: Settings },
] as const;

export const workerNavigation = [
  { name: "העבודות שלי", href: "/worker", icon: ClipboardList },
  { name: "הדיווחים שלי", href: "/worker/reports", icon: BarChart3 },
] as const;

/** Project page tabs — project info only (BOQ / invoices are separate modules) */
export const projectTabs = [
  { id: "overview", label: "מידע כללי" },
  { id: "employees", label: "עובדים" },
  { id: "documents", label: "מסמכים" },
  { id: "status", label: "סטטוס והתקדמות" },
] as const;

export const quickNavigation = [
  { name: "חשבונות / דפי מדידה", href: "/invoices" },
  { name: "פרויקט חדש", href: "/projects/new" },
  { name: "כתבי כמויות", href: "/boq" },
  { name: "מנהלי עבודה", href: "/foremen" },
  { name: "אפליקציית שטח", href: "/field" },
] as const;
