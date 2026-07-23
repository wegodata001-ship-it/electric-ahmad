# Sprint 1 — Complete Client Demo

**סטטוס:** Demo-ready (internal QA)  
**תאריך:** 2026-07-20  

אין מנועים מקבילים. כל מודול מחובר למנועים המשותפים.

---

## Portals

| Portal | Home | Roles |
|--------|------|-------|
| System | `/system` | SYSTEM_MANAGER, ADMIN |
| Project | `/project` | PROJECT_MANAGER (+ Ops may enter) |
| Operations | `/operations` | OPERATIONS_MANAGER (+ PM may enter) |
| Field | `/field` | FIELD_MANAGER |

Login אחד: `/login` → redirect לפי role.

---

## מה מחובר

| מנוע / מודול | איפה |
|--------------|------|
| Navigation מלא | `src/lib/portals/config.ts` |
| הרשאות Portal | `src/lib/portals/access.ts` + PortalShell |
| Dashboards חיים | `features/platform/components/portal-dashboards.tsx` |
| Approvals | `/operations/approvals`, `/project/approvals` → ApprovalsInbox |
| Workflow Center | `/system/workflow`, `/operations/workflow` |
| Documents Hub | ארכיון מסמכים ב־system/project/operations |
| Notification Center | `*/notifications` + פעמון ב־Header |
| Conversation | Timeline (`WorkflowEvent` / `conversation.message`) |
| Action Bar | `ActionBarContainer` + `DocumentActionBar` |
| Share Links | `/api/share-links` + Hub pages |
| WhatsApp Hub | תשתית `whatsapp-hub` + UI (wa.me) |
| Field modules | יומן, תעודות, צוות, ביצוע, מסמכים |
| Legacy office deep links | `(main)` עטוף ב־`OfficePortalBridge` |

---

## חשבונות Demo

סיסמה: `WegoAudit123!`

| User | Portal |
|------|--------|
| sysmgr | System |
| pm1 | Project |
| opsmgr | Operations |
| fieldmgr | Field |

---

## זרימות לבדיקת לקוח

1. Login לכל תפקיד → Portal נכון  
2. Field: יצירת יומן → שליחה לאישור  
3. Ops/PM: מרכז אישורים → אישור/דחייה  
4. Documents archive → שליחה ללקוח / WhatsApp  
5. Share Links hub  
6. Conversation על מסמך Workflow (`?documentId=`)  
7. Refresh בתוך Portal — נשאר מחובר  
8. Mobile drawer בכל Portal  

---

## Future Portals

Finance / Customer / Supplier / Inspector — ארכיטקטורה פתוחה (`FUTURE_PORTAL_IDS`). לא במימוש Sprint 1.
