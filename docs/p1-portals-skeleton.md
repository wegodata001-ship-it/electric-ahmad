# P1 — Portals Architecture Skeleton

**סטטוס:** UX Review polish applied — ממתין לאישור  
**תאריך:** 2026-07-20  
**היקף:** Platform Skeleton בלבד — ללא לוגיקה עסקית, DB, Workflow, APIs עסקיים.  
**UX Review:** [`docs/p1-ux-review.md`](./p1-ux-review.md) · צילומים: [`docs/p1-ux-screenshots/`](./p1-ux-screenshots/)

אין להתחיל **P2** עד אישור מפורש.

---

## 1. מפת ה־Portals

```
/login  (מסך אחד)
   ├─ SYSTEM_MANAGER / ADMIN  →  /system
   ├─ PROJECT_MANAGER         →  /project
   ├─ OPERATIONS_MANAGER      →  /operations
   └─ FIELD_MANAGER           →  /field
```

| Portal | Path | תפקידים |
|--------|------|---------|
| System | `/system` | SYSTEM_MANAGER, ADMIN, legacy admin |
| Project | `/project` | PROJECT_MANAGER |
| Operations | `/operations` | OPERATIONS_MANAGER |
| Field | `/field` | FIELD_MANAGER |

---

## 2. מבנה Routing

```
src/app/(portals)/
  system/          → PortalShell(system)
    page.tsx                   Dashboard placeholder
    companies|users|workflow|documents|settings/
  project/         → PortalShell(project)
    page.tsx
    projects|boq|rooms|accounts|documents/
  operations/      → PortalShell(operations)
    page.tsx
    approvals|documents|reports/

src/app/(field)/
  layout.tsx       → PortalShell(field)  (מלבד /field/login)
  field/
    page.tsx                   Dashboard placeholder
    work-diaries/**            live (קיים)
    execution/                 placeholder
    documents/                 placeholder
    …מודולים קיימים נוספים
```

Config מרכזי: `src/lib/portals/config.ts`

---

## 3. Layout / Sidebar / Header / Dashboard

כל Portal משתמש ב־`PortalShell`:

| אלמנט | מימוש |
|--------|--------|
| Layout | `PortalShell` |
| Sidebar | `PortalSidebar` (desktop + mobile drawer) |
| Header | `PortalHeader` + Breadcrumb + Notification icon + User menu |
| Dashboard | `PortalDashboardPlaceholder` (widgets ריקים) |

ניווט לפי Portal — ראה `PORTALS.*.nav` ב־config.

---

## 4. Login Redirect

- מסך אחד: `/login`
- API: `POST /api/auth/login` — מזהה תפקיד, מנפיק session (office / field), מחזיר `portalPath`
- Proxy: משתמש מחובר ב־`/login` → portal לפי role; שטח ללא session → `/login`
- `/field/login` מפנה ל־`/login` (BC path נשמר)

---

## 5. Responsive

| Breakpoint | התנהגות |
|------------|---------|
| Desktop (`lg+`) | Sidebar קבוע |
| Tablet / Mobile | Header menu → drawer צד |
| Dashboard grid | 1 → 2 → 4 עמודות |

---

## 6. רכיבים משותפים

| רכיב | נתיב |
|------|------|
| PortalShell | `src/components/portal/portal-shell.tsx` |
| PortalSidebar | `portal-sidebar.tsx` |
| PortalHeader | `portal-header.tsx` |
| PortalBreadcrumb | `portal-breadcrumb.tsx` |
| PortalNotificationIcon | `portal-notification-icon.tsx` (placeholder) |
| PortalUserMenu | `portal-user-menu.tsx` |
| DashboardWidgetContainer | `dashboard-widget-container.tsx` |
| ActionBarContainer | `action-bar-container.tsx` |
| PortalDashboardPlaceholder | `portal-dashboard-placeholder.tsx` |
| PortalPlaceholderPage | `portal-placeholder-page.tsx` |

---

## 7. רכיבים ייחודיים לכל Portal

ב־P1 אין רכיבים ייחודיים מעבר ל־**nav items + accent color + dashboard widget titles** ב־`PORTALS` config.

| Portal | ייחודי ב־P1 |
|--------|-------------|
| System | nav: Companies, Users, Workflow, Documents, Settings · accent `#0f172a` |
| Project | nav: Projects, BOQ, Rooms, Accounts, Documents · accent `#1d4ed8` |
| Operations | nav: Approvals, Documents, Reports · accent `#b45309` |
| Field | nav: Work Diary (live), Execution, Documents · accent `#1e40af` · session field |

---

## 8. צילומי מסך

תיקייה: `docs/p1-ux-screenshots/`  
כולל Desktop / Tablet 768 / Mobile 360·390·430 / Drawer / Breadcrumb / Login / After logout.

---

## 8.1 Future Portals (ארכיטקטורה פתוחה)

ניתן להוסיף Portal נוסף בלי לשנות מנועים משותפים:

| Future Portal | דוגמה |
|---------------|--------|
| Finance Portal | `/finance` |
| Customer Portal | `/customer` |
| Supplier Portal | `/supplier` |
| Inspector Portal | `/inspector` |

הוספה = `PortalDefinition` + route group + role→home. ראו `FUTURE_PORTAL_IDS` ב־config.

---

## 9. מה לא נגענו (מכוון)

- Database / Migrations  
- Workflow / Documents / Finance / Work Diary business logic  
- APIs עסקיים (מלבד login redirect + `/api/field/auth/me` ל־shell)  
- WhatsApp, Notifications, Conversation, Share Links, Approval Center  
- Dashboard widgets אמיתיים  

---

## 10. תנאי מעבר ל־P2

לאחר אישור מבנה + UX של P1 בלבד.
