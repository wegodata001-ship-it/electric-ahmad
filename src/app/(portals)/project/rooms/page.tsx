import Link from "next/link";
import { ProjectsPage } from "@/features/projects/components/projects-page";

/** Rooms are managed per-project — enter a project → Performance / measurement */
export default function Page() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900">
        ניהול חדרים מתבצע בתוך פרויקט (ביצועים / דפי מדידה). בחרו פרויקט למטה או{" "}
        <Link href="/project/projects" className="font-semibold underline">
          לרשימת הפרויקטים
        </Link>
        .
      </div>
      <ProjectsPage />
    </div>
  );
}
