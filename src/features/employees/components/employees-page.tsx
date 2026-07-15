"use client";

import { useEffect, useState, type FormEvent } from "react";
import { employeeService } from "@/features/employees/services/employee.service";
import type { Employee } from "@/types";
import {
  Card,
  Avatar,
  Badge,
  Button,
  Modal,
  useToast,
} from "@/components/ui";
import { formatNumber } from "@/utils/format";
import { EMPLOYEE_ROLE_LABELS } from "@/constants";
import { Phone, Mail, UserPlus } from "lucide-react";

export function EmployeesPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loginTarget, setLoginTarget] = useState<Employee | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

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

  function openProvision(emp: Employee) {
    if (emp.role === "worker") {
      setMessage("לעובדים אין משתמש מערכת — תיעוד בלבד");
      return;
    }
    setLoginTarget(emp);
    setLoginForm({
      username: emp.email.split("@")[0] || "",
      password: "",
    });
  }

  async function submitProvision(e: FormEvent) {
    e.preventDefault();
    if (!loginTarget) return;
    setBusyId(loginTarget.id);
    setMessage(null);
    try {
      const result = await employeeService.provisionFieldLogin(
        loginTarget.id,
        loginForm.username,
        loginForm.password
      );
      setEmployees((prev) =>
        prev.map((e) => (e.id === loginTarget.id ? result.employee : e))
      );
      setLoginTarget(null);
      toast.success(
        result.login
          ? `נוצר משתמש FIELD_MANAGER: ${result.login.username}`
          : `${loginTarget.fullName} כבר מקושר למשתמש מערכת`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה ביצירת משתמש");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">עובדים</h1>
        <p className="text-sm text-gray-500 mt-1">
          עובדים = תיעוד בלבד (בלי Login). מנהלי עבודה = משתמש מערכת ·{" "}
          {employees.length}
        </p>
      </div>

      {message && (
        <div className="text-sm text-primary-800 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
          {message}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
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
                <p className="text-sm font-semibold text-primary-600">
                  {formatNumber(emp.completedQuantity)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">פתוח</p>
                <p className="text-sm font-semibold text-gray-600">
                  {formatNumber(emp.openQuantity)}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              <p className="text-xs text-gray-400">
                {emp.projectIds.length} פרויקטים ·{" "}
                {emp.role === "worker"
                  ? "ללא Login"
                  : emp.hasSystemUser
                    ? "FIELD_MANAGER מחובר"
                    : "ללא משתמש מערכת"}
              </p>
              {emp.role !== "worker" && !emp.hasSystemUser && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  loading={busyId === emp.id}
                  onClick={() => openProvision(emp)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  צור התחברות לשטח
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={!!loginTarget}
        onClose={() => setLoginTarget(null)}
        title="יצירת התחברות לשטח"
        description={
          loginTarget
            ? `מנהל עבודה: ${loginTarget.fullName}`
            : undefined
        }
      >
        <form onSubmit={submitProvision} className="space-y-3">
          <label className="block text-sm">
            <span className="text-gray-600">שם משתמש</span>
            <input
              required
              dir="ltr"
              value={loginForm.username}
              onChange={(e) =>
                setLoginForm((f) => ({ ...f, username: e.target.value }))
              }
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">סיסמה</span>
            <input
              required
              type="password"
              dir="ltr"
              minLength={6}
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm((f) => ({ ...f, password: e.target.value }))
              }
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLoginTarget(null)}
            >
              ביטול
            </Button>
            <Button type="submit" loading={!!busyId}>
              צור משתמש
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
