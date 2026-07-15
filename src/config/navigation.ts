import {
  BarChart3,
  Building2,
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
 * Dashboard → Delivery notes → Projects → BOQ → Invoices → Foremen → Employees → Reports → Settings
 */
export const mainNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "תעודות משלוח", href: "/delivery-notes", icon: Package },
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
  { name: "תעודת משלוח חדשה", href: "/delivery-notes/new" },
  { name: "פרויקט חדש", href: "/projects/new" },
  { name: "חשבון חדש", href: "/invoices/new" },
  { name: "כתבי כמויות", href: "/boq" },
  { name: "מנהלי עבודה", href: "/foremen" },
  { name: "אפליקציית שטח", href: "/field" },
] as const;
