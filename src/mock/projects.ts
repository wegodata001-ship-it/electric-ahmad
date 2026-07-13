import type { Project, ProjectStatus } from "@/types";
import { CONTRACTORS, LOCATIONS } from "@/constants";
import { employees } from "./employees";
import { generateId, pick, randomInt, seededRandom } from "./generators";

const PROJECT_NAMES = [
  "מגדל משרדים - תל אביב",
  "פרויקט מגורים - ירושלים",
  "מרכז מסחרי - חיפה",
  "פארק הייטק - ראשון לציון",
  "מגדלי BSR - פתח תקווה",
  "קמפוס אוניברסיטה - באר שבע",
  "מרכז רפואי - נתניה",
  "נמל חדש - אשדוד",
  "Diamond Tower - רמת גן",
  "פארק תעשייה - הרצליה",
] as const;

const STATUSES: ProjectStatus[] = ["active", "active", "active", "active", "completed", "on_hold", "planning", "active", "active", "active"];

const IMAGES = [
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80",
  "https://images.unsplash.com/photo-1590654516934-539be705d393?w=800&q=80",
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80",
  "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&q=80",
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
  "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=800&q=80",
];

export function generateProjects(count = 10): Project[] {
  const rand = seededRandom(100);
  const foremen = employees.filter((e) => e.role === "foreman" || e.role === "manager");
  const projects: Project[] = [];

  for (let i = 0; i < count; i++) {
    const contractValue = randomInt(500000, 5000000, rand);
    const progress = randomInt(5, 95, rand);
    const completedValue = Math.round((contractValue * progress) / 100);
    const foreman = pick(foremen.length > 0 ? foremen : employees, rand);
    const status = STATUSES[i] ?? "active";
    const employeeCount = randomInt(3, 12, rand);

    projects.push({
      id: generateId("proj", i + 1),
      name: PROJECT_NAMES[i] ?? `פרויקט ${i + 1}`,
      contractNumber: `WEGO-2025-${String(i + 1).padStart(3, "0")}`,
      contractor: pick(CONTRACTORS, rand),
      location: pick(LOCATIONS, rand),
      foremanId: foreman.id,
      foremanName: foreman.fullName,
      status,
      contractValue,
      completedValue,
      progress,
      employeeCount,
      imageUrl: IMAGES[i % IMAGES.length],
      startDate: new Date(2024, randomInt(0, 6, rand), randomInt(1, 28, rand)).toISOString(),
      endDate: new Date(2026, randomInt(0, 11, rand), randomInt(1, 28, rand)).toISOString(),
      description: `פרויקט חשמל מקיף הכולל התקנת מערכות חשמל, תקשורת, אבטחה ותאורה.`,
      createdAt: new Date(2024, randomInt(0, 3, rand), randomInt(1, 28, rand)).toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return projects;
}

export const projects = generateProjects(10);

// Assign employees to projects
employees.forEach((emp, i) => {
  const projectCount = emp.role === "worker" ? 1 : 2;
  for (let j = 0; j < projectCount; j++) {
    const projIndex = (i + j) % projects.length;
    if (!emp.projectIds.includes(projects[projIndex].id)) {
      emp.projectIds.push(projects[projIndex].id);
    }
  }
});
