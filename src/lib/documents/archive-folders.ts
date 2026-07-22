/**
 * מקור אמת יחיד — תיקיות ארכיון מסמכים בפרויקט.
 * אין מודול תמונות נפרד; תמונות/סרטונים הם תיקיות תחת מסמכים.
 */
export const DOCUMENT_ARCHIVE_FOLDERS = [
  {
    id: "work_diary",
    label: "יומני עבודה",
    folderNames: ["יומני עבודה"],
  },
  {
    id: "performance",
    label: "דוחות ביצוע",
    folderNames: ["דוחות ביצוע", "דפי מדידה"],
  },
  {
    id: "delivery",
    label: "תעודות משלוח",
    folderNames: ["תעודות משלוח"],
  },
  {
    id: "invoice",
    label: "חשבונות",
    folderNames: ["חשבונות", "חשבון"],
  },
  {
    id: "tax_invoice",
    label: "חשבוניות",
    folderNames: ["חשבוניות"],
  },
  {
    id: "receipt",
    label: "קבלות",
    folderNames: ["קבלות"],
  },
  {
    id: "quote",
    label: "הצעות מחיר",
    folderNames: ["הצעות מחיר"],
  },
  {
    id: "contract",
    label: "חוזים",
    folderNames: ["חוזים"],
  },
  {
    id: "plans",
    label: "תוכניות",
    folderNames: ["תוכניות"],
  },
  {
    id: "approvals",
    label: "אישורים",
    folderNames: ["אישורים"],
  },
  {
    id: "general",
    label: "מסמכים כלליים",
    folderNames: ["מסמכים כלליים", "כתב כמויות"],
  },
  {
    id: "images",
    label: "תמונות",
    folderNames: ["תמונות"],
  },
  {
    id: "videos",
    label: "סרטונים",
    folderNames: ["סרטונים"],
  },
  {
    id: "archive",
    label: "ארכיון",
    folderNames: ["ארכיון"],
  },
] as const;

export type DocumentArchiveFolderId =
  (typeof DOCUMENT_ARCHIVE_FOLDERS)[number]["id"];

export function defaultFolderForDocumentType(
  type: string
): string {
  if (type === "image") return "תמונות";
  if (type === "video") return "סרטונים";
  return "מסמכים כלליים";
}

export function guessDocumentFolderId(input: {
  type: string;
  name: string;
  folderPath?: string | null;
}): DocumentArchiveFolderId {
  const folder = (input.folderPath ?? "").trim();
  const name = `${input.name} ${folder}`.toLowerCase();

  if (folder.startsWith("יומני עבודה") || name.includes("יומן")) {
    return "work_diary";
  }
  if (folder.startsWith("דוחות ביצוע") || folder.startsWith("דפי מדידה")) {
    return "performance";
  }
  if (folder.startsWith("תעודות משלוח") || name.includes("משלוח")) {
    return "delivery";
  }
  if (folder.startsWith("חשבוניות") || name.includes("חשבונית")) {
    return "tax_invoice";
  }
  if (
    folder.startsWith("חשבונות") ||
    folder.startsWith("חשבון") ||
    name.includes("חשבון")
  ) {
    return "invoice";
  }
  if (folder.startsWith("קבלות") || name.includes("קבלה")) return "receipt";
  if (folder.startsWith("הצעות מחיר") || name.includes("הצעת מחיר")) {
    return "quote";
  }
  if (folder.startsWith("חוזים") || name.includes("חוזה")) return "contract";
  if (folder.startsWith("תוכניות") || name.includes("תוכנית") || input.type === "dwg") {
    return "plans";
  }
  if (folder.startsWith("אישורים") || name.includes("אישור")) return "approvals";
  if (folder.startsWith("ארכיון")) return "archive";
  if (folder.startsWith("סרטונים") || input.type === "video") return "videos";
  if (folder.startsWith("תמונות") || input.type === "image") return "images";
  if (name.includes("מדידה") || name.includes("ביצוע")) return "performance";
  return "general";
}
