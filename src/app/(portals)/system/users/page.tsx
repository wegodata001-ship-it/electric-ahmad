import { EmployeesPage } from "@/features/employees/components/employees-page";
import { ForemenPage } from "@/features/foremen/components/foremen-page";

export default function Page() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-bold text-gray-900">מנהלי עבודה</h2>
        <ForemenPage />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold text-gray-900">עובדים</h2>
        <EmployeesPage />
      </section>
    </div>
  );
}
