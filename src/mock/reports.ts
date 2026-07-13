import type { WorkReport } from "@/types";
import { boqItems } from "./boq";
import { employees } from "./employees";
import { projects } from "./projects";
import { generateId, pick, randomInt, seededRandom } from "./generators";

const NOTES = [
  "בוצע לפי תוכנית",
  "עבודה תקינה",
  "דורש בדיקה נוספת",
  "הושלם בהצלחה",
  "בוצע חלקית - ממשיך מחר",
  undefined,
  undefined,
  undefined,
];

export function generateReports(count = 100): WorkReport[] {
  const rand = seededRandom(300);
  const reports: WorkReport[] = [];
  const workers = employees.filter((e) => e.role === "worker" || e.role === "foreman");

  for (let i = 0; i < count; i++) {
    const project = pick(projects, rand);
    const projectItems = boqItems.filter((b) => b.projectId === project.id);
    const item = pick(projectItems.length > 0 ? projectItems : boqItems, rand);
    const worker = pick(workers, rand);
    const quantity = randomInt(1, 10, rand);
    const daysAgo = randomInt(0, 60, rand);
    const reportedAt = new Date();
    reportedAt.setDate(reportedAt.getDate() - daysAgo);
    reportedAt.setHours(randomInt(6, 18, rand), randomInt(0, 59, rand));

    reports.push({
      id: generateId("rep", i + 1),
      projectId: project.id,
      projectName: project.name,
      boqItemId: item.id,
      boqItemCode: item.code,
      boqItemDescription: item.description,
      employeeId: worker.id,
      employeeName: worker.fullName,
      quantity,
      unit: item.unit,
      notes: pick(NOTES, rand),
      photoUrls: rand() > 0.5 ? [`https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&q=80`] : [],
      videoUrls: [],
      reportedAt: reportedAt.toISOString(),
      createdAt: reportedAt.toISOString(),
    });
  }

  return reports.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
}

export const reports = generateReports(100);
