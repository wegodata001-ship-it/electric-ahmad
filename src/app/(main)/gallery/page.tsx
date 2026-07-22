import { redirect } from "next/navigation";

/** מודול הגלריה בוטל — תמונות מנוהלות תחת מסמכים */
export default function Page() {
  redirect("/documents");
}
