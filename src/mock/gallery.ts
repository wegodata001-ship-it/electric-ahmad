import type { GalleryItem } from "@/types";
import { projects } from "./projects";
import { employees } from "./employees";
import { reports } from "./reports";
import { generateId, pick, randomInt, seededRandom } from "./generators";

const IMAGE_URLS = [
  "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&q=80",
  "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600&q=80",
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80",
  "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=600&q=80",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
  "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600&q=80",
];

const TITLES = [
  "התקנת לוח חשמל",
  "הנחת כבלים",
  "התקנת שקעים",
  "בדיקת מערכת",
  "תאורת חירום",
  "מצלמת אבטחה",
  "ארון תקשורת",
  "עמוד תאורה",
];

export function generateGallery(count = 40): GalleryItem[] {
  const rand = seededRandom(600);
  const items: GalleryItem[] = [];

  for (let i = 0; i < count; i++) {
    const project = pick(projects, rand);
    const uploader = pick(employees, rand);
    const daysAgo = randomInt(0, 60, rand);
    const uploadedAt = new Date();
    uploadedAt.setDate(uploadedAt.getDate() - daysAgo);
    const url = pick(IMAGE_URLS, rand);

    items.push({
      id: generateId("gal", i + 1),
      projectId: project.id,
      projectName: project.name,
      type: "image",
      url,
      thumbnailUrl: url,
      title: pick(TITLES, rand),
      uploadedBy: uploader.fullName,
      uploadedAt: uploadedAt.toISOString(),
      reportId: reports[i % reports.length]?.id,
    });
  }

  return items.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export const galleryItems = generateGallery(40);
