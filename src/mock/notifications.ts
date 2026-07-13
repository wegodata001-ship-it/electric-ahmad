import type { Notification } from "@/types";
import { projects } from "./projects";
import { employees } from "./employees";
import { generateId, seededRandom } from "./generators";

export function generateNotifications(count = 15): Notification[] {
  const rand = seededRandom(800);
  const notifications: Notification[] = [];

  const templates = [
    { type: "report" as const, title: "דיווח חדש", message: "עובד דיווח ביצוע חדש" },
    { type: "item_completed" as const, title: "סעיף הושלם", message: "סעיף בכתב הכמויות הושלם" },
    { type: "document" as const, title: "מסמך חדש", message: "מסמך חדש הועלה לפרויקט" },
    { type: "invoice" as const, title: "חשבון חלקי", message: "חשבון חלקי חדש נוצר" },
    { type: "employee" as const, title: "עובד חדש", message: "עובד חדש שובץ לפרויקט" },
    { type: "system" as const, title: "עדכון מערכת", message: "עדכון חדש זמין במערכת" },
  ];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const project = projects[i % projects.length];
    const daysAgo = Math.floor(rand() * 7);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    notifications.push({
      id: generateId("notif", i + 1),
      type: template.type,
      title: template.title,
      message: `${template.message} - ${project.name}`,
      read: i > 4,
      projectId: project.id,
      link: `/projects/${project.id}`,
      createdAt: createdAt.toISOString(),
    });
  }

  return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const notifications = generateNotifications(15);

export const currentUser = {
  id: "user_001",
  name: "אדמין WEGO",
  email: "admin@wego-electric.co.il",
  role: "מנהל מערכת",
  avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Admin&backgroundColor=2563eb",
};
