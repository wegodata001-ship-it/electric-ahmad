"use client";

import { useEffect, useState } from "react";
import { employeeService } from "@/features/employees/services/employee.service";
import type { Employee } from "@/types";
import { Card, Avatar, Badge } from "@/components/ui";
import { formatNumber } from "@/utils/format";
import { EMPLOYEE_ROLE_LABELS } from "@/constants";
import { Phone, Mail } from "lucide-react";

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    employeeService.getAll().then(setEmployees);
  }, []);

  const filtered =
    filter === "all"
      ? employees
      : employees.filter((e) => e.role === filter || e.status === filter);

  const filters = [
    { id: "all", label: "הכל" },
    { id: "worker", label: "עובדים" },
    { id: "foreman", label: "מנהלי עבודה" },
    { id: "active", label: "פעילים" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">עובדים</h1>
        <p className="text-sm text-gray-500 mt-1">{employees.length} עובדים במערכת</p>
      </div>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f.id
                ? "bg-primary-50 text-primary-700 font-medium"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((emp) => (
          <Card key={emp.id} hover>
            <div className="flex items-center gap-3 mb-4">
              <Avatar src={emp.avatarUrl} name={emp.fullName} size="lg" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{emp.fullName}</p>
                <Badge variant="primary" className="mt-1">
                  {EMPLOYEE_ROLE_LABELS[emp.role]}
                </Badge>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-500 mb-4">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" />
                <span dir="ltr">{emp.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{emp.email}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-400">בוצע</p>
                <p className="text-sm font-semibold text-primary-600">{formatNumber(emp.completedQuantity)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">פתוח</p>
                <p className="text-sm font-semibold text-gray-600">{formatNumber(emp.openQuantity)}</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {emp.projectIds.length} פרויקטים משויכים
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
