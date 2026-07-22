import { redirect } from "next/navigation";

/** יצירת חשבון עוברת דרך דפי מדידה בעץ הפרויקט */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.projectId ? `?projectId=${encodeURIComponent(sp.projectId)}` : "";
  redirect(`/invoices${q}`);
}
