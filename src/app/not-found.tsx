import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-primary-600 mb-4">404</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">הדף לא נמצא</h1>
        <p className="text-sm text-gray-500 mb-6">
          הדף שחיפשת אינו קיים או הוסר מהמערכת.
        </p>
        <Link href="/dashboard">
          <Button>חזרה לדשבורד</Button>
        </Link>
      </div>
    </div>
  );
}
