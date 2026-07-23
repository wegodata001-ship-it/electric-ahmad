# P1 UX Review — Validation Checklist

**סטטוס:** UX polish applied · צילומים מוכנים · ממתין לאישור  
**תאריך:** 2026-07-20  
**אין להתחיל P2 / Authorization / live Widgets / Approval Center**

**חשבונות לבדיקה ידנית** (סיסמה `WegoAudit123!`):  
`sysmgr` → `/system` · `pm1` → `/project` · `opsmgr` → `/operations` · `fieldmgr` → `/field`

---

## 1. האם כל Portal מרגיש מערכת אחרת?

| Portal | שפה | Accent | Header | Nav ייעודי | Dashboard Mock |
|--------|-----|--------|--------|------------|----------------|
| System | ניהול מערכת | slate `#0f172a` | ניהול מערכת | חברות, משתמשים, Workflow, הגדרות | Companies, Users, Workflow Health, System Alerts |
| Project | ניהול פרויקט | blue `#1d4ed8` | ניהול פרויקט | פרויקטים, כתב כמויות, חדרים, חשבונות | Projects, Progress, Accounts, Documents |
| Operations | ניהול אישורים | amber `#b45309` | ניהול אישורים | אישורים, מסמכים, דוחות | Pending Approvals, Returned, Delayed |
| Field | עבודה בשטח | teal `#0f766e` | עבודה בשטח | יומן עבודה, ביצוע, מסמכים | Work Diary, Execution, Photos, Tasks |

אותה משפחת עיצוב (rounded-2xl, RTL, typography) — הבדל בשפה, accent, tint, badges, mock content.

---

## 2. Navigation Scope (אין תפריטים מיותרים)

| Portal | אין | יש |
|--------|-----|-----|
| Field | Settings, Companies, Users, Finance, BOQ, Rooms | Dashboard, יומן עבודה, ביצוע, מסמכים |
| Operations | BOQ, Rooms, Project Setup, Companies | Dashboard, אישורים, מסמכים, דוחות |
| Project | Users, System Settings, Approvals queue | פרויקטים, BOQ, חדרים, חשבונות, מסמכים |
| System | BOQ, Field diary | חברות, משתמשים, Workflow, הגדרות |

---

## 3. Mobile breakpoints לבדיקה ידנית

| רוחב | מה לבדוק |
|------|----------|
| 360 | Drawer, Header menu 44px, breadcrumb שורה שנייה |
| 390 | כמו 360 + widgets stack |
| 430 | drawer `min(86vw,18rem)`, כפתורי פעולה |

Desktop (`lg+`): sidebar קבוע.

---

## 4. Login / Refresh / Logout

| בדיקה | תוצאה מצופה |
|--------|-------------|
| Login → Redirect | לפי role ל־`/system` `/project` `/operations` `/field` |
| Refresh בתוך Portal | נשאר בנתיב (session תקף) |
| Logout → Login מחדש | חוזר ל־`/login` ואז ל־Portal |
| Session פג | Redirect ל־`/login?next=…` |

---

## 5. Breadcrumb

פורמט: `{headerTitle} / {nav label}`  
עובד בכל Portal דרך `PortalBreadcrumb`.

---

## 6. Future Portals (ארכיטקטורה פתוחה)

ניתן להוסיף Portal חדש **בלי** לשנות מנועים משותפים:

| Future Portal | דוגמה לנתיב |
|---------------|-------------|
| Finance Portal | `/finance` |
| Customer Portal | `/customer` |
| Supplier Portal | `/supplier` |
| Inspector Portal | `/inspector` |

הוספה = `PortalDefinition` ב־`config.ts` + route group + מיפוי role → home.  
אין שינוי ב־Workflow / Documents Hub / Notification / WhatsApp.

ראו גם `FUTURE_PORTAL_IDS` ב־`src/lib/portals/config.ts`.

---

## 7. צילומי מסך (Deliverables)

תיקייה: `docs/p1-ux-screenshots/`

| קובץ | תוכן |
|------|------|
| `system-desktop.png` | System dashboard |
| `project-desktop.png` | Project dashboard |
| `operations-desktop.png` | Operations dashboard |
| `field-desktop.png` | Field dashboard |
| `*-tablet-768.png` | Tablet |
| `*-mobile-390.png` | Mobile 390 + drawer open where relevant |
| `login.png` | Unified login |

---

## 8. אחרי אישור UX

רק אז — P2 (Navigation wiring / העברת מסכים קיימים), באישור מפורש.
