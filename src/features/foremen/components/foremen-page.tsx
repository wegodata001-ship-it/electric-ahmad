"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Badge,
  Button,
  Modal,
  Input,
  ConfirmationDialog,
  useToast,
} from "@/components/ui";
import { foremenService } from "@/features/foremen/services/foremen.service";
import type { ForemanSummary } from "@/types";
import {
  Eye,
  Pencil,
  Ban,
  CheckCircle2,
  KeyRound,
  Link2,
  FileText,
  CalendarDays,
  Users,
  Trash2,
} from "lucide-react";

export function ForemenPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [list, setList] = useState<ForemanSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    username: "",
    password: "",
  });

  const [editTarget, setEditTarget] = useState<ForemanSummary | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<ForemanSummary | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ForemanSummary | null>(null);

  function reload() {
    foremenService
      .getAll()
      .then(setList)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      );
  }

  useEffect(() => {
    reload();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setCreatedCreds(null);
    try {
      const created = await foremenService.create(form);
      setCreatedCreds(
        `נוצר מנהל עבודה: ${created.fullName} · משתמש: ${created.username} · תפקיד: FIELD_MANAGER`
      );
      setForm({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        username: "",
        password: "",
      });
      setShowForm(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירה");
    } finally {
      setCreating(false);
    }
  }

  function loginUrl() {
    if (typeof window === "undefined") return "/field/login";
    return `${window.location.origin}/field/login`;
  }

  async function copyLoginLink() {
    try {
      await navigator.clipboard.writeText(loginUrl());
      success("הקישור הועתק", loginUrl());
    } catch {
      toastError("לא ניתן להעתיק");
    }
  }

  async function saveEdit() {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await foremenService.update(editTarget.id, editForm);
      setEditTarget(null);
      reload();
      success("הפרטים עודכנו");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעדכון");
    } finally {
      setEditSaving(false);
    }
  }

  async function doResetPassword() {
    if (!resetTarget) return;
    setResetSaving(true);
    try {
      await foremenService.resetPassword(resetTarget.id, newPassword);
      setResetTarget(null);
      setNewPassword("");
      success("הסיסמה אופסה בהצלחה");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה באיפוס סיסמה");
    } finally {
      setResetSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">מנהלי עבודה</h1>
          <p className="text-sm text-gray-500 mt-1">
            לכל מנהל עבודה נוצר משתמש מערכת (FIELD_MANAGER) להתחברות ל־/field
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "ביטול" : "הוסף מנהל עבודה"}
        </Button>
      </div>

      {createdCreds && (
        <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {createdCreds}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <Card padding="lg">
          <h2 className="text-base font-semibold mb-3">
            מנהל עבודה חדש + התחברות
          </h2>
          <form
            onSubmit={onCreate}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <Field
              label="שם פרטי"
              value={form.firstName}
              onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
              required
            />
            <Field
              label="שם משפחה"
              value={form.lastName}
              onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
              required
            />
            <Field
              label="טלפון"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              required
            />
            <Field
              label="אימייל (אופציונלי)"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            />
            <Field
              label="שם משתמש"
              value={form.username}
              onChange={(v) => setForm((f) => ({ ...f, username: v }))}
              required
              dir="ltr"
            />
            <Field
              label="סיסמה"
              value={form.password}
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
              required
              type="password"
              dir="ltr"
            />
            <div className="sm:col-span-2">
              <Button type="submit" loading={creating}>
                צור מנהל עבודה + משתמש מערכת
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3 md:hidden">
        {list.map((f) => (
          <Card key={f.id} padding="sm">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="min-w-0 text-right"
                onClick={() => router.push(`/foremen/${f.id}`)}
              >
                <p className="font-semibold text-gray-900">{f.fullName}</p>
                <p className="mt-1 text-xs text-gray-500" dir="ltr">
                  {f.phone}
                </p>
              </button>
              <Badge
                className={
                  f.isDeleted
                    ? "bg-red-50 text-red-700"
                    : f.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-600"
                }
              >
                {f.isDeleted ? "נמחק" : f.status === "active" ? "פעיל" : "מושבת"}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-2 text-center">
              <div>
                <p className="text-xs text-gray-400">פרויקטים</p>
                <p className="font-semibold">{f.activeProjectCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">יומנים</p>
                <p className="font-semibold">{f.openJournals}/{f.closedJournals}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">דיווחים</p>
                <p className="font-semibold">{f.reportsCount}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/foremen/${f.id}`)}
              >
                <Eye className="h-4 w-4" />
                צפייה
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEditTarget(f);
                  setEditForm({
                    firstName: f.firstName,
                    lastName: f.lastName,
                    phone: f.phone,
                    email: f.email,
                    notes: f.notes ?? "",
                  });
                }}
              >
                <Pencil className="h-4 w-4" />
                עריכה
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/reports?foremanId=${f.id}`)}
              >
                <FileText className="h-4 w-4" />
                דיווחים
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={copyLoginLink}
              >
                <Link2 className="h-4 w-4" />
                קישור כניסה
              </Button>
              {!f.isDeleted && (
                <Button
                  size="sm"
                  variant={f.status === "active" ? "secondary" : "outline"}
                  className="w-full"
                  onClick={async () => {
                    if (f.status === "active") await foremenService.deactivate(f.id);
                    else await foremenService.activate(f.id);
                    reload();
                  }}
                >
                  {f.status === "active" ? (
                    <Ban className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {f.status === "active" ? "השבת" : "הפעל"}
                </Button>
              )}
              {!f.isDeleted && (
                <Button
                  size="sm"
                  variant="danger"
                  className="w-full"
                  onClick={() => setDeleteTarget(f)}
                >
                  <Trash2 className="h-4 w-4" />
                  מחיקה
                </Button>
              )}
            </div>
          </Card>
        ))}
        {!error && list.length === 0 && (
          <Card padding="lg">
            <p className="text-sm text-gray-400 text-center">לא נמצאו מנהלי עבודה</p>
          </Card>
        )}
      </div>

      <Card padding="none" className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-gray-50/80 text-xs text-gray-500">
              <tr>
                <th className="text-right px-4 py-3">שם</th>
                <th className="text-right px-4 py-3">טלפון</th>
                <th className="text-right px-4 py-3">סטטוס</th>
                <th className="text-right px-4 py-3">פרויקטים</th>
                <th className="text-right px-4 py-3">יומנים</th>
                <th className="text-right px-4 py-3">דיווחים</th>
                <th className="text-right px-4 py-3">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <tr
                  key={f.id}
                  className="border-t border-gray-100 hover:bg-gray-50/40"
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-semibold text-gray-900 hover:text-primary-700"
                      onClick={() => router.push(`/foremen/${f.id}`)}
                    >
                      {f.fullName}
                    </button>
                    {f.username && (
                      <p className="text-xs text-gray-400" dir="ltr">
                        @{f.username}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {f.phone}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        f.isDeleted
                          ? "bg-red-50 text-red-700"
                          : f.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                      }
                    >
                      {f.isDeleted
                        ? "נמחק"
                        : f.status === "active"
                          ? "פעיל"
                          : "מושבת"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{f.activeProjectCount}</td>
                  <td className="px-4 py-3">
                    {f.openJournals}/{f.closedJournals}
                  </td>
                  <td className="px-4 py-3">{f.reportsCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                      <Act
                        title="עריכה"
                        onClick={() => {
                          setEditTarget(f);
                          setEditForm({
                            firstName: f.firstName,
                            lastName: f.lastName,
                            phone: f.phone,
                            email: f.email,
                            notes: f.notes ?? "",
                          });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Act>
                      <Act
                        title="צפייה"
                        onClick={() => router.push(`/foremen/${f.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Act>
                      {f.status === "active" && !f.isDeleted ? (
                        <Act
                          title="השבת"
                          onClick={async () => {
                            await foremenService.deactivate(f.id);
                            reload();
                          }}
                        >
                          <Ban className="h-3.5 w-3.5 text-amber-700" />
                        </Act>
                      ) : (
                        !f.isDeleted && (
                          <Act
                            title="הפעלה מחדש"
                            onClick={async () => {
                              await foremenService.activate(f.id);
                              reload();
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          </Act>
                        )
                      )}
                      <Act
                        title="איפוס סיסמה"
                        onClick={() => {
                          setResetTarget(f);
                          setNewPassword("");
                        }}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Act>
                      <Act title="העתק קישור התחברות" onClick={copyLoginLink}>
                        <Link2 className="h-3.5 w-3.5" />
                      </Act>
                      <Act
                        title="כל הדיווחים"
                        onClick={() =>
                          router.push(`/reports?foremanId=${f.id}`)
                        }
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Act>
                      <Act
                        title="יומני עבודה"
                        onClick={() =>
                          router.push(`/foremen/${f.id}?tab=journals`)
                        }
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                      </Act>
                      <Act
                        title="העובדים שלו"
                        onClick={() =>
                          router.push(`/foremen/${f.id}?tab=crew`)
                        }
                      >
                        <Users className="h-3.5 w-3.5" />
                      </Act>
                      {!f.isDeleted && (
                        <Act
                          title="מחיקה"
                          onClick={() => setDeleteTarget(f)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                        </Act>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!error && list.length === 0 && (
          <p className="px-6 py-10 text-sm text-gray-400 text-center">
            לא נמצאו מנהלי עבודה
          </p>
        )}
      </Card>

      <Card padding="md">
        <p className="text-sm text-gray-600">
          התחברות שטח:{" "}
          <a
            href="/field/login"
            className="text-primary-600 font-medium underline"
          >
            /field/login
          </a>
        </p>
      </Card>

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="עריכת מנהל עבודה"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-gray-600">שם פרטי</span>
              <Input
                className="mt-1"
                value={editForm.firstName}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, firstName: e.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              <span className="text-gray-600">שם משפחה</span>
              <Input
                className="mt-1"
                value={editForm.lastName}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, lastName: e.target.value }))
                }
              />
            </label>
          </div>
          <label className="text-sm block">
            <span className="text-gray-600">טלפון</span>
            <Input
              className="mt-1"
              value={editForm.phone}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </label>
          <label className="text-sm block">
            <span className="text-gray-600">אימייל</span>
            <Input
              className="mt-1"
              value={editForm.email}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </label>
          <label className="text-sm block">
            <span className="text-gray-600">הערות</span>
            <Input
              className="mt-1"
              value={editForm.notes}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              ביטול
            </Button>
            <Button onClick={saveEdit} loading={editSaving}>
              שמור
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="איפוס סיסמה"
        description={resetTarget?.fullName}
      >
        <div className="space-y-3">
          <Input
            type="password"
            dir="ltr"
            placeholder="סיסמה חדשה (לפחות 6 תווים)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetTarget(null)}>
              ביטול
            </Button>
            <Button onClick={doResetPassword} loading={resetSaving}>
              אפס סיסמה
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="מחיקת מנהל עבודה"
        description={
          deleteTarget
            ? `למחוק את ${deleteTarget.fullName}? המחיקה היא רכה — ההיסטוריה נשמרת וההתחברות תיחסם.`
            : ""
        }
        confirmLabel="מחק"
        variant="danger"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await foremenService.softDelete(deleteTarget.id);
          setDeleteTarget(null);
          reload();
          success("מנהל העבודה נמחק (soft delete)");
        }}
      />
    </div>
  );
}

function Act({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-white"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  dir?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        dir={dir}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
      />
    </label>
  );
}
