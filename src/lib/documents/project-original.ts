/** Marks the client-supplied PDF uploaded at project intake. */
export const PROJECT_ORIGINAL_SOURCE_TYPE = "project_original";
export const PROJECT_ORIGINAL_FOLDER = "מסמך מקור";

export function originalProjectFileName(name: string | null | undefined): string {
  const base = (name ?? "").trim() || "מסמך מקור";
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}
