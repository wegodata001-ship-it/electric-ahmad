import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardList,
  FileText,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
  CheckSquare,
  BookOpen,
  Truck,
  Link2,
  User,
} from "lucide-react";

export type PortalId = "system" | "project" | "operations" | "field" | "driver";

export type PortalNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  mode?: "placeholder" | "live";
};

export type PortalTheme = {
  accent: string;
  accentSoft: string;
  accentMuted: string;
  sidebarBg: string;
  headerTint: string;
  badge: string;
};

export type PortalDefinition = {
  id: PortalId;
  name: string;
  shortName: string;
  headerTitle: string;
  home: string;
  description: string;
  theme: PortalTheme;
  accent: string;
  nav: PortalNavItem[];
};

export const PORTALS: Record<PortalId, PortalDefinition> = {
  system: {
    id: "system",
    name: "System Portal",
    shortName: "מערכת",
    headerTitle: "ניהול מערכת",
    home: "/system/accounts",
    description: "עץ פרויקט · משתמשים · תשתית",
    accent: "#0f172a",
    theme: {
      accent: "#0f172a",
      accentSoft: "#e2e8f0",
      accentMuted: "#334155",
      sidebarBg: "#f8fafc",
      headerTint: "#f1f5f9",
      badge: "SYS",
    },
    nav: [
      { label: "עץ פרויקט", href: "/system/accounts", icon: GitBranch, mode: "live" },
      { label: "משתמשים", href: "/system/users", icon: Users, mode: "live" },
      { label: "Workflow", href: "/system/workflow", icon: GitBranch, mode: "live" },
      { label: "מרכז מסמכים", href: "/system/documents", icon: FolderOpen, mode: "live" },
      { label: "הגדרות", href: "/system/settings", icon: Settings, mode: "live" },
    ],
  },
  project: {
    id: "project",
    name: "Project Portal",
    shortName: "פרויקט",
    headerTitle: "ניהול פרויקט",
    home: "/project/accounts",
    description: "עץ פרויקט · מדידות · חשבונות · תפעול חוצה-פרויקטים",
    accent: "#1d4ed8",
    theme: {
      accent: "#1d4ed8",
      accentSoft: "#dbeafe",
      accentMuted: "#1e40af",
      sidebarBg: "#f8fbff",
      headerTint: "#eff6ff",
      badge: "PRJ",
    },
    nav: [
      { label: "עץ פרויקט", href: "/project/accounts", icon: GitBranch, mode: "live" },
      { label: "תיקונים", href: "/project/approvals", icon: CheckSquare, mode: "live" },
      { label: "תעודות משלוח", href: "/project/delivery-notes", icon: Truck, mode: "live" },
      { label: "מרכז מסמכים", href: "/project/documents", icon: FileText, mode: "live" },
    ],
  },
  operations: {
    id: "operations",
    name: "Operations Portal",
    shortName: "תפעול",
    headerTitle: "מנהל תפעול",
    home: "/operations/accounts",
    description: "עץ פרויקט · עבודה יומית · ללא שליחה ללקוח",
    accent: "#b45309",
    theme: {
      accent: "#b45309",
      accentSoft: "#fef3c7",
      accentMuted: "#92400e",
      sidebarBg: "#fffbeb",
      headerTint: "#fff7ed",
      badge: "OPS",
    },
    nav: [
      { label: "עץ פרויקט", href: "/operations/accounts", icon: GitBranch, mode: "live" },
      {
        label: "תיקונים",
        href: "/operations/approvals",
        icon: CheckSquare,
        mode: "live",
      },
      {
        label: "סידורי עבודה",
        href: "/operations/work-orders",
        icon: ClipboardList,
        mode: "live",
      },
      { label: "מרכז מסמכים", href: "/operations/documents", icon: FolderOpen, mode: "live" },
      { label: "פרופיל", href: "/operations/profile", icon: User, mode: "live" },
    ],
  },
  field: {
    id: "field",
    name: "Field Portal",
    shortName: "שטח",
    headerTitle: "עבודה בשטח",
    home: "/field",
    description: "נוכחות · סידורים · יומן · תעודות",
    accent: "#0f766e",
    theme: {
      accent: "#0f766e",
      accentSoft: "#ccfbf1",
      accentMuted: "#115e59",
      sidebarBg: "#f0fdfa",
      headerTint: "#ecfdf5",
      badge: "FLD",
    },
    nav: [
      { label: "בית", href: "/field", icon: LayoutDashboard, mode: "live" },
      {
        label: "סידורי עבודה",
        href: "/field/work-orders",
        icon: ClipboardList,
        mode: "live",
      },
      {
        label: "יומן עבודה",
        href: "/field/work-diaries",
        icon: BookOpen,
        mode: "live",
      },
      {
        label: "תעודות משלוח",
        href: "/field/delivery-notes",
        icon: Truck,
        mode: "live",
      },
      {
        label: "תיקונים",
        href: "/field/approvals",
        icon: CheckSquare,
        mode: "live",
      },
    ],
  },
  driver: {
    id: "driver",
    name: "Driver Portal",
    shortName: "נהג",
    headerTitle: "נהג משאית",
    home: "/driver",
    description: "תעודות משלוח בלבד",
    accent: "#1e3a5f",
    theme: {
      accent: "#1e3a5f",
      accentSoft: "#e8eef5",
      accentMuted: "#334e68",
      sidebarBg: "#f7fafc",
      headerTint: "#edf2f7",
      badge: "DRV",
    },
    nav: [
      { label: "בית", href: "/driver", icon: LayoutDashboard, mode: "live" },
      {
        label: "תעודה חדשה",
        href: "/driver/delivery-notes/new",
        icon: Truck,
        mode: "live",
      },
      {
        label: "התעודות שלי",
        href: "/driver/delivery-notes",
        icon: FileText,
        mode: "live",
      },
      { label: "פרופיל", href: "/driver/profile", icon: User, mode: "live" },
    ],
  },
};

export const FUTURE_PORTAL_IDS = [
  "finance",
  "customer",
  "supplier",
  "inspector",
] as const;

export function portalHomeForRole(role?: string | null): string {
  switch (role) {
    case "SYSTEM_MANAGER":
    case "ADMIN":
    case "admin":
    case "מנהל מערכת":
      return PORTALS.system.home;
    case "SECRETARY":
    case "מזכירה":
      return "/attendance/checkin";
    case "PROJECT_MANAGER":
      return PORTALS.project.home;
    case "OPERATIONS_MANAGER":
      return PORTALS.operations.home;
    case "FIELD_MANAGER":
      return PORTALS.field.home;
    case "TRUCK_DRIVER":
    case "נהג":
      return PORTALS.driver.home;
    default:
      return "/login";
  }
}

export function portalIdForRole(role?: string | null): PortalId | null {
  const home = portalHomeForRole(role);
  if (home === "/system" || home.startsWith("/system/")) return "system";
  if (home === "/project" || home.startsWith("/project/")) return "project";
  if (home === "/operations" || home.startsWith("/operations/")) return "operations";
  if (home === "/field" || home.startsWith("/field/")) return "field";
  if (home === "/driver" || home.startsWith("/driver/")) return "driver";
  return null;
}

export function isPortalPath(pathname: string): boolean {
  return (
    pathname === "/system" ||
    pathname.startsWith("/system/") ||
    pathname === "/project" ||
    pathname.startsWith("/project/") ||
    pathname === "/operations" ||
    pathname.startsWith("/operations/") ||
    pathname === "/field" ||
    pathname.startsWith("/field/") ||
    pathname === "/driver" ||
    pathname.startsWith("/driver/")
  );
}

export const PORTAL_DASHBOARD_MOCKS: Record<
  PortalId,
  Array<{
    id: string;
    title: string;
    subtitle: string;
    value: string;
    hint: string;
    icon: LucideIcon;
  }>
> = {
  system: [],
  project: [],
  operations: [],
  field: [],
  driver: [],
};
