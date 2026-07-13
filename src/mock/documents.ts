import type { Document, DocumentType } from "@/types";
import { projects } from "./projects";
import { employees } from "./employees";
import { generateId, pick, randomInt, seededRandom } from "./generators";

const DOC_NAMES: Record<DocumentType, string[]> = {
  pdf: ["חוזה חשמל", "תוכנית חשמל", "אישור מהנדס", "פרוטוקול ישיבה", "דוח בדיקה"],
  excel: ["כתב כמויות", "לוח זמנים", "תקציב פרויקט", "רשימת חומרים"],
  word: ["הסכם עבודה", "מפרט טכני", "הוראות בטיחות"],
  dwg: ["תוכנית חשמל קומה 1", "תוכנית חשמל קומה 2", "תוכנית תאורה", "סכמת לוחות"],
  image: ["תמונת אתר", "תמונת לוח חשמל", "תמונת התקנה"],
  video: ["סרטון התקנה", "סרטון בדיקה"],
  other: ["קובץ כללי"],
};

const TYPES: DocumentType[] = ["pdf", "pdf", "excel", "word", "dwg", "image", "image"];

export function generateDocuments(count = 50): Document[] {
  const rand = seededRandom(400);
  const documents: Document[] = [];

  for (let i = 0; i < count; i++) {
    const project = pick(projects, rand);
    const type = pick(TYPES, rand);
    const names = DOC_NAMES[type];
    const name = `${pick(names, rand)} - ${project.name.split(" - ")[0]}`;
    const uploader = pick(employees, rand);
    const daysAgo = randomInt(0, 90, rand);
    const uploadedAt = new Date();
    uploadedAt.setDate(uploadedAt.getDate() - daysAgo);

    documents.push({
      id: generateId("doc", i + 1),
      projectId: project.id,
      projectName: project.name,
      name,
      type,
      size: randomInt(100000, 10000000, rand),
      url: "#",
      version: randomInt(1, 3, rand),
      uploadedBy: uploader.fullName,
      uploadedAt: uploadedAt.toISOString(),
      versions: [
        {
          version: 1,
          uploadedBy: uploader.fullName,
          uploadedAt: uploadedAt.toISOString(),
          size: randomInt(100000, 10000000, rand),
          url: "#",
        },
      ],
    });
  }

  return documents.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export const documents = generateDocuments(50);
