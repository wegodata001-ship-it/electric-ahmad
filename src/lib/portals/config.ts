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
  MessageSquare,
  Share2,
  Bell,
  Link2,
  Clock,
  User,
} from "lucide-react";

export type PortalId = "system" | "project" | "operations" | "field";

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
    home: "/system",
    description: "חברות · משתמשים · חשבונות · תשתית",
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
      { label: "לוח בקרה", href: "/system", icon: LayoutDashboard, mode: "live" },
      { label: "פרויקטים", href: "/system/companies", icon: Building2, mode: "live" },
      {
        label: "חשבונות / עץ פרויקט",
        href: "/system/accounts",
        icon: Wallet,
        mode: "live",
      },
      { label: "משתמשים", href: "/system/users", icon: Users, mode: "live" },
      { label: "Workflow", href: "/system/workflow", icon: GitBranch, mode: "live" },
      { label: "מסמכים", href: "/system/documents", icon: FolderOpen, mode: "live" },
      { label: "התראות", href: "/system/notifications", icon: Bell, mode: "live" },
      { label: "WhatsApp", href: "/system/whatsapp", icon: MessageSquare, mode: "live" },
      { label: "Share Links", href: "/system/share-links", icon: Share2, mode: "live" },
      { label: "הגדרות", href: "/system/settings", icon: Settings, mode: "live" },
    ],
  },
  project: {
    id: "project",
    name: "Project Portal",
    shortName: "פרויקט",
    headerTitle: "אישורים ומסמכים",
    home: "/project",
    description: "אישור · החזרה · שיתוף · חתימות",
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
      { label: "בית", href: "/project", icon: LayoutDashboard, mode: "live" },
      { label: "אישורים", href: "/project/approvals", icon: CheckSquare, mode: "live" },
      { label: "מסמכים", href: "/project/documents", icon: FileText, mode: "live" },
      { label: "Share Links", href: "/project/share-links", icon: Link2, mode: "live" },
      { label: "חתימות", href: "/project/signatures", icon: CheckSquare, mode: "live" },
      { label: "התראות", href: "/project/notifications", icon: Bell, mode: "live" },
    ],
  },
  operations: {
    id: "operations",
    name: "Operations Portal",
    shortName: "תפעול",
    headerTitle: "עבודה יומית",
    home: "/operations",
    description: "נוכחות · סידורים · אישורים",
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
      { label: "בית", href: "/operations", icon: LayoutDashboard, mode: "live" },
      { label: "נוכחות", href: "/operations/attendance", icon: Clock, mode: "live" },
      {
        label: "סידורי עבודה",
        href: "/operations/work-orders",
        icon: ClipboardList,
        mode: "live",
      },
      {
        label: "אישורים",
        href: "/operations/approvals",
        icon: CheckSquare,
        mode: "live",
      },
      { label: "התראות", href: "/operations/notifications", icon: Bell, mode: "live" },
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
        label: "אישורים",
        href: "/field/approvals",
        icon: CheckSquare,
        mode: "live",
      },
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
    case "PROJECT_MANAGER":
      return PORTALS.project.home;
    case "OPERATIONS_MANAGER":
      return PORTALS.operations.home;
    case "FIELD_MANAGER":
      return PORTALS.field.home;
    default:
      return "/login";
  }
}

export function portalIdForRole(role?: string | null): PortalId | null {
  const home = portalHomeForRole(role);
  if (home === "/system") return "system";
  if (home === "/project") return "project";
  if (home === "/operations") return "operations";
  if (home === "/field") return "field";
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
    pathname.startsWith("/field/")
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
};
