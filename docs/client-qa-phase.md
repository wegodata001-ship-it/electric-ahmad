# Client QA Phase — Sprint 1 Demo

**סטטוס:** Sprint 1 Approved · Client Demo  
**תאריך פתיחה:** 2026-07-20  
**מטרה:** אימות זרימות עסקיות מול משתמשים אמיתיים — לא פיתוח פיצ'רים.

---

## כללי שלב

| מותר | אסור |
|------|------|
| בדיקות לפי Checklist | פיצ'רים חדשים |
| איסוף משוב למסמך | הרחבות ארכיטקטורה |
| תיקון באגים **קריטיים בלבד** | Refactor |
| תיעוד Severity + Suggested Fix | שינוי מנועים משותפים |

**מדיניות תיקון:** מתקנים רק תקלות שחוסמות זרימה מרכזית (Login, Submit, Approve/Reject, Session, Crash). כל השאר → מסמך משוב → תכנון Sprint 2.

---

## חשבונות Demo

סיסמה: `WegoAudit123!`

| תפקיד | משתמש | Portal |
|--------|--------|--------|
| System Manager | `sysmgr` | `/system` |
| Project Manager | `pm1` | `/project` |
| Operations Manager | `opsmgr` | `/operations` |
| Field Manager | `fieldmgr` | `/field` |

Login אחד: `/login`

---

## 1. Checklist — System Manager

| # | בדיקה | Pass | Fail | הערות |
|---|--------|:----:|:----:|--------|
| S1 | Login → `/system` | ☐ | ☐ | |
| S2 | Dashboard נטען (counts / widgets) | ☐ | ☐ | |
| S3 | Companies / Projects | ☐ | ☐ | |
| S4 | Users (עובדים + מנהלי עבודה) | ☐ | ☐ | |
| S5 | Workflow Center | ☐ | ☐ | |
| S6 | Documents Hub / ארכיון | ☐ | ☐ | |
| S7 | Audit (אם קיים במסך / לוגים) | ☐ | ☐ | |
| S8 | Settings | ☐ | ☐ | |
| S9 | Notifications + פעמון | ☐ | ☐ | |
| S10 | Logout → Login מחדש | ☐ | ☐ | |
| S11 | Refresh בתוך Portal — נשאר מחובר | ☐ | ☐ | |

---

## 2. Checklist — Project Manager

| # | בדיקה | Pass | Fail | הערות |
|---|--------|:----:|:----:|--------|
| P1 | Login → `/project` | ☐ | ☐ | |
| P2 | Projects — רשימה / כניסה לפרויקט | ☐ | ☐ | |
| P3 | BOQ | ☐ | ☐ | |
| P4 | Rooms (דרך פרויקט / ביצועים) | ☐ | ☐ | |
| P5 | Execution / ביצועים | ☐ | ☐ | |
| P6 | Accounts / חשבונות | ☐ | ☐ | |
| P7 | Documents | ☐ | ☐ | |
| P8 | Reports (אם זמין מ־Portal / deep link) | ☐ | ☐ | |
| P9 | Share Links | ☐ | ☐ | |
| P10 | Approvals (תור PM) | ☐ | ☐ | |
| P11 | Logout | ☐ | ☐ | |

---

## 3. Checklist — Operations Manager

| # | בדיקה | Pass | Fail | הערות |
|---|--------|:----:|:----:|--------|
| O1 | Login → `/operations` | ☐ | ☐ | |
| O2 | Approval Center — רשימת ממתינים | ☐ | ☐ | |
| O3 | Approve | ☐ | ☐ | |
| O4 | Reject | ☐ | ☐ | |
| O5 | Return for Fix | ☐ | ☐ | |
| O6 | Documents Review | ☐ | ☐ | |
| O7 | Conversation (`documentId`) | ☐ | ☐ | |
| O8 | Notifications | ☐ | ☐ | |
| O9 | Workflow Center | ☐ | ☐ | |
| O10 | Logout | ☐ | ☐ | |

---

## 4. Checklist — Field Manager

| # | בדיקה | Pass | Fail | הערות |
|---|--------|:----:|:----:|--------|
| F1 | Login → `/field` | ☐ | ☐ | |
| F2 | Work Diary — יצירה / עריכה | ☐ | ☐ | |
| F3 | Execution Report / ביצוע | ☐ | ☐ | |
| F4 | Photos | ☐ | ☐ | |
| F5 | Attachments | ☐ | ☐ | |
| F6 | Submit לאישור | ☐ | ☐ | |
| F7 | Conversation | ☐ | ☐ | |
| F8 | WhatsApp (שליחה / קישור) | ☐ | ☐ | |
| F9 | Mobile — drawer + טפסים | ☐ | ☐ | |
| F10 | Logout | ☐ | ☐ | |

---

## 5. Mobile QA

| # | בדיקה | Android | iPhone | הערות |
|---|--------|:-------:|:------:|--------|
| M1 | Drawer פתיחה/סגירה | ☐ | ☐ | |
| M2 | Responsive 360–430 | ☐ | ☐ | |
| M3 | Forms — הקלדה / שמירה | ☐ | ☐ | |
| M4 | Action Bar | ☐ | ☐ | |
| M5 | Upload Images | ☐ | ☐ | |
| M6 | Share Links | ☐ | ☐ | |
| M7 | WhatsApp | ☐ | ☐ | |

רוחבים מומלצים: 360 · 390 · 430 · Tablet 768

---

## 6. תבנית הערת משוב

כל הערה חייבת לכלול:

```
ID: QA-XXX
Date:
Reporter:
Portal: System | Project | Operations | Field
Module:
Screen: (URL / שם מסך)
Description:
Severity: Critical | High | Medium | Low
Category: 🔴 Bug | 🟡 UX | 🔵 Business | 🟢 Nice to Have
Steps to Reproduce:
Expected:
Actual:
Suggested Fix:
Screenshot / Video: (קישור או קובץ)
Status: Open | Critical-Fixed | Deferred to Sprint 2
```

---

## 7. יומן משוב (להדבקה / מילוי)

### 🔴 Bugs

| ID | Portal | Module | Screen | Description | Severity | Suggested Fix | Status |
|----|--------|--------|--------|-------------|----------|---------------|--------|
| | | | | | | | |

### 🟡 UX Improvements

| ID | Portal | Module | Screen | Description | Severity | Suggested Fix | Status |
|----|--------|--------|--------|-------------|----------|---------------|--------|
| | | | | | | | |

### 🔵 Business Requests

| ID | Portal | Module | Screen | Description | Severity | Suggested Fix | Status |
|----|--------|--------|--------|-------------|----------|---------------|--------|
| | | | | | | | |

### 🟢 Nice To Have

| ID | Portal | Module | Screen | Description | Severity | Suggested Fix | Status |
|----|--------|--------|--------|-------------|----------|---------------|--------|
| | | | | | | | |

---

## 8. דוח מסכם (למילוי בסיום QA)

קובץ יעד: `docs/client-qa-summary.md` (נוצר אחרי סבב הבדיקות)

### 8.1 באגים שנמצאו
_(רשימה מסוננת מ־🔴)_

### 8.2 שיפורי UX
_(🟡)_

### 8.3 בקשות עסקיות חדשות
_(🔵)_

### 8.4 בעיות ביצועים
| נושא | Portal | תיאור | Severity |
|------|--------|--------|----------|
| | | | |

### 8.5 בעיות מובייל
| נושא | מכשיר | תיאור | Severity |
|------|--------|--------|----------|
| | | | |

### 8.6 הערכת מוכנות ל־Production

| קריטריון | ציון (1–5) | הערה |
|----------|------------|------|
| Login / Sessions | | |
| Field → Approval flow | | |
| Documents / Share / WhatsApp | | |
| Permissions | | |
| Mobile usability | | |
| Stability (no critical crashes) | | |
| **סה״כ מוכנות** | | Demo only / Soft launch / Not ready |

### 8.7 המלצה ל־Sprint 2
- Top 5 באגים/פערים לטיפול  
- Top 5 בקשות עסקיות  
- מה במפורש **לא** להכניס ל־Sprint 2  

---

## 9. החלטה נוכחית

- **Sprint 1** = גרסת Demo מאושרת  
- **השלב הבא** = בדיקות עם לקוחות אמיתיים + איסוף משוב  
- **Sprint 2** = רק לאחר סיכום QA ותעדוף לפי צרכים מהשטח  

אין להתחיל פיתוח פיצ'רים / ארכיטקטורה עד החלטה מפורשת אחרי הדוח המסכם.
