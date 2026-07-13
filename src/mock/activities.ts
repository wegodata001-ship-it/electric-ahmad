import type { Activity, ActivityType } from "@/types";
import { projects } from "./projects";
import { employees } from "./employees";
import { reports } from "./reports";
import { documents } from "./documents";
import { partialInvoices } from "./invoices";
import { generateId, seededRandom } from "./generators";

const ACTIVITY_TEMPLATES: { type: ActivityType; title: string; description: string }[] = [
  { type: "report_created", title: "דיווח חדש", description: "דיווח ביצוע חדש נוצר" },
  { type: "quantity_updated", title: "עדכון כמות", description: "כמות בוצעה עודכנה" },
  { type: "document_uploaded", title: "מסמך חדש", description: "מסמך חדש הועלה לפרויקט" },
  { type: "invoice_created", title: "חשבון חלקי", description: "חשבון חלקי חדש נוצר" },
  { type: "status_changed", title: "שינוי סטטוס", description: "סטטוס פרויקט עודכן" },
  { type: "employee_assigned", title: "שיבוץ עובד", description: "עובד שובץ לפרויקט" },
  { type: "project_updated", title: "עדכון פרויקט", description: "פרטי פרויקט עודכנו" },
];

export function generateActivities(count = 80): Activity[] {
  const rand = seededRandom(700);
  const activities: Activity[] = [];

  for (let i = 0; i < count; i++) {
    const template = ACTIVITY_TEMPLATES[i % ACTIVITY_TEMPLATES.length];
    const project = projects[i % projects.length];
    const employee = employees[i % employees.length];
    const daysAgo = Math.floor(rand() * 30);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(Math.floor(rand() * 12) + 7);

    let description = template.description;
    if (template.type === "report_created" && reports[i % reports.length]) {
      const report = reports[i % reports.length];
      description = `${report.employeeName} דיווח ${report.quantity} ${report.unit} ב-${report.boqItemDescription}`;
    } else if (template.type === "document_uploaded" && documents[i % documents.length]) {
      description = `${documents[i % documents.length].name} הועלה על ידי ${documents[i % documents.length].uploadedBy}`;
    } else if (template.type === "invoice_created" && partialInvoices[i % partialInvoices.length]) {
      const inv = partialInvoices[i % partialInvoices.length];
      description = `חשבון ${inv.invoiceNumber} בסך ₪${inv.amount.toLocaleString()}`;
    }

    activities.push({
      id: generateId("act", i + 1),
      projectId: project.id,
      projectName: project.name,
      type: template.type,
      title: template.title,
      description,
      userId: employee.id,
      userName: employee.fullName,
      createdAt: createdAt.toISOString(),
    });
  }

  return activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const activities = generateActivities(80);
