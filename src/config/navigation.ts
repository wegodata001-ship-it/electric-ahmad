import {
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  FolderOpen,
  Image,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
} from "lucide-react";

export const mainNavigation = [
  { name: "דשבורד", href: "/dashboard", icon: LayoutDashboard },
  { name: "פרויקטים", href: "/projects", icon: Building2 },
  { name: "כתב כמויות", href: "/boq", icon: ClipboardList },
  { name: "עובדים", href: "/employees", icon: Users },
  { name: "דיווחים", href: "/reports", icon: BarChart3 },
  { name: "מסמכים", href: "/documents", icon: FileText },
  { name: "חשבונות חלקיים", href: "/partial-invoices", icon: Receipt },
  { name: "גלריה", href: "/gallery", icon: Image },
  { name: "הגדרות", href: "/settings", icon: Settings },
] as const;

export const workerNavigation = [
  { name: "העבודות שלי", href: "/worker", icon: ClipboardList },
  { name: "הדיווחים שלי", href: "/worker/reports", icon: BarChart3 },
  { name: "התמונות שלי", href: "/worker/photos", icon: Image },
] as const;

export const projectTabs = [
  { id: "overview", label: "סקירה" },
  { id: "boq", label: "כתב כמויות" },
  { id: "reports", label: "דיווחים" },
  { id: "employees", label: "עובדים" },
  { id: "documents", label: "מסמכים" },
  { id: "gallery", label: "גלריה" },
  { id: "activity", label: "פעילות" },
  { id: "settings", label: "הגדרות" },
] as const;
