"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  Copy,
  Edit3,
  KeyRound,
  MoreVertical,
  Plus,
  Power,
  Search,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  MANAGED_USER_ROLES,
  type ManagedUserRole,
} from "@/lib/auth/roles";
import {
  Badge,
  Button,
  ConfirmationDialog,
  Modal,
  useToast,
} from "@/components/ui";
import {
  systemUsersService,
  type ManagedUser,
  type ManagedUserPayload,
  type ManagedUserStatus,
} from "@/features/system-users/services/system-users.service";

type ProjectOption = {
  id: string;
  name: string;
  contractNumber: string;
};

type UserForm = ManagedUserPayload & {
  password: string;
  confirmPassword: string;
};

const ROLE_META: Record<
  ManagedUserRole,
  { label: string; description: string }
> = {
  SYSTEM_MANAGER: {
    label: "מנהל מערכת",
    description: "גישה מלאה למערכת.",
  },
  OPERATIONS_MANAGER: {
    label: "מנהל תפעול",
    description: "גישה תפעולית בהתאם להרשאות הקיימות.",
  },
  PROJECT_MANAGER: {
    label: "מנהל פרויקט",
    description: "ניהול הפרויקטים המשויכים אליו.",
  },
  FIELD_MANAGER: {
    label: "מנהל עבודה",
    description: "עבודת שטח, יומנים, תעודות ונוכחות.",
  },
  TRUCK_DRIVER: {
    label: "נהג",
    description: "פעולות נהג ותעודות משלוח.",
  },
};

const STATUS_META: Record<
  ManagedUserStatus,
  { label: string; variant: "success" | "warning" | "default" }
> = {
  ACTIVE: { label: "פעיל", variant: "success" },
  DISABLED: { label: "מושבת", variant: "warning" },
  ARCHIVED: { label: "בארכיון", variant: "default" },
};

const EMPTY_FORM: UserForm = {
  name: "",
  username: "",
  email: "",
  phone: "",
  role: "PROJECT_MANAGER",
  projectIds: [],
  allowNoProjects: false,
  password: "",
  confirmPassword: "",
};

function generatePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const values = new Uint32Array(14);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => chars[value % chars.length]).join("");
}

function formatDate(value: string | null) {
  if (!value) return "טרם התחבר";
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function roleLabel(role: string) {
  return ROLE_META[role as ManagedUserRole]?.label ?? role;
}

export function SystemUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [details, setDetails] = useState<ManagedUser | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [statusChange, setStatusChange] = useState<{
    user: ManagedUser;
    status: ManagedUserStatus;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [credentials, setCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  const reload = useCallback(async () => {
    const [{ users: nextUsers }, nextProjects] = await Promise.all([
      systemUsersService.list(),
      apiClient.get<ProjectOption[]>("/api/projects"),
    ]);
    setUsers(nextUsers);
    setProjects(
      nextProjects.map(({ id, name, contractNumber }) => ({
        id,
        name,
        contractNumber,
      }))
    );
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "טעינת המשתמשים נכשלה"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [reload, toast]);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      const roleMatch =
        filter === "all"
          ? user.status !== "ARCHIVED"
          : filter === "inactive"
            ? user.status !== "ACTIVE"
            : user.role === filter;
      if (!roleMatch) return false;
      if (!needle) return true;
      return [user.name, user.username, user.email, user.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [filter, search, users]);

  function openCreate() {
    const password = generatePassword();
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      password,
      confirmPassword: password,
    });
    setFormOpen(true);
  }

  function openEdit(user: ManagedUser) {
    const role = MANAGED_USER_ROLES.includes(user.role as ManagedUserRole)
      ? (user.role as ManagedUserRole)
      : "PROJECT_MANAGER";
    setEditing(user);
    setForm({
      name: user.name,
      username: user.username ?? "",
      email: user.email,
      phone: user.phone ?? "",
      role,
      projectIds: user.projects.map((project) => project.id),
      allowNoProjects:
        role === "PROJECT_MANAGER" && user.projects.length === 0,
      password: "",
      confirmPassword: "",
    });
    setFormOpen(true);
  }

  function toggleProject(projectId: string) {
    setForm((current) => ({
      ...current,
      projectIds: current.projectIds.includes(projectId)
        ? current.projectIds.filter((id) => id !== projectId)
        : [...current.projectIds, projectId],
    }));
  }

  async function submitUser(event: React.FormEvent) {
    event.preventDefault();
    if (!editing && form.password !== form.confirmPassword) {
      toast.error("אימות הסיסמה אינו תואם");
      return;
    }
    if (
      form.role === "PROJECT_MANAGER" &&
      !form.projectIds.length &&
      !form.allowNoProjects
    ) {
      toast.error("בחרו פרויקט או אשרו שמירה ללא שיוך");
      return;
    }
    if (form.role === "FIELD_MANAGER" && !form.projectIds.length) {
      toast.error("יש לבחור לפחות אתר עבודה אחד");
      return;
    }
    setBusy(true);
    try {
      const payload: ManagedUserPayload = {
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone,
        role: form.role,
        projectIds: form.projectIds,
        allowNoProjects: form.allowNoProjects,
      };
      if (editing) {
        await systemUsersService.update(editing.id, payload);
        toast.success("פרטי המשתמש עודכנו");
      } else {
        const result = await systemUsersService.create({
          ...payload,
          password: form.password,
        });
        setCredentials(result.temporaryCredentials);
        toast.success("המשתמש נוצר בהצלחה");
      }
      setFormOpen(false);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שמירת המשתמש נכשלה");
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(user: ManagedUser, status: ManagedUserStatus) {
    setStatusChange({ user, status });
  }

  async function confirmStatusChange() {
    if (!statusChange) return;
    const { user, status } = statusChange;
    setBusy(true);
    try {
      await systemUsersService.setStatus(user.id, status);
      await reload();
      toast.success(
        status === "ACTIVE"
          ? "המשתמש הופעל מחדש"
          : status === "ARCHIVED"
            ? "המשתמש הועבר לארכיון"
            : "המשתמש הושבת"
      );
      setStatusChange(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function deletePermanently() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await systemUsersService.deletePermanently(deleteTarget.id);
      await reload();
      toast.success("המשתמש נמחק לצמיתות");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "המחיקה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(event: React.FormEvent) {
    event.preventDefault();
    if (!resetTarget) return;
    setBusy(true);
    try {
      await systemUsersService.resetPassword(resetTarget.id, resetPassword);
      setCredentials({
        username: resetTarget.username ?? resetTarget.email,
        password: resetPassword,
      });
      setResetTarget(null);
      setResetPassword("");
      toast.success("הסיסמה אופסה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "איפוס הסיסמה נכשל");
    } finally {
      setBusy(false);
    }
  }

  async function copyCredentials() {
    if (!credentials) return;
    await navigator.clipboard.writeText(
      `שם משתמש: ${credentials.username}\nסיסמה זמנית: ${credentials.password}`
    );
    toast.success("פרטי ההתחברות הועתקו");
  }

  const filters = [
    { id: "all", label: "הכל" },
    { id: "SYSTEM_MANAGER", label: "מנהלי מערכת" },
    { id: "OPERATIONS_MANAGER", label: "מנהלי תפעול" },
    { id: "PROJECT_MANAGER", label: "מנהלי פרויקט" },
    { id: "FIELD_MANAGER", label: "מנהלי עבודה" },
    { id: "TRUCK_DRIVER", label: "נהגים" },
    { id: "inactive", label: "לא פעילים" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">ניהול משתמשים</h1>
          <p className="mt-1 text-sm text-slate-500">
            יצירה, שיוך, אבטחה וניהול מחזור החיים של משתמשי המערכת
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          משתמש חדש
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="חיפוש לפי שם, Username, טלפון או אימייל"
              className="h-11 w-full rounded-xl border border-slate-200 pr-10 pl-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium ${
                  filter === item.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">טוען…</div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  {[
                    "שם",
                    "שם משתמש",
                    "טלפון",
                    "אימייל",
                    "תפקיד",
                    "פרויקטים",
                    "סטטוס",
                    "כניסה אחרונה",
                    "פעולות",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="cursor-pointer hover:bg-slate-50/80"
                    onClick={() => setDetails(user)}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {user.name}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {user.username ?? "—"}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {user.phone ?? "—"}
                    </td>
                    <td className="max-w-48 truncate px-4 py-3" dir="ltr">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">{roleLabel(user.role)}</td>
                    <td className="px-4 py-3">{user.projects.length}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_META[user.status].variant}>
                        {STATUS_META[user.status].label}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatDate(user.lastLoginAt)}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <UserActions
                        user={user}
                        busy={busy}
                        onEdit={openEdit}
                        onDetails={setDetails}
                        onReset={(target) => {
                          setResetTarget(target);
                          setResetPassword(generatePassword());
                        }}
                        onStatus={changeStatus}
                        onDelete={setDeleteTarget}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {filteredUsers.map((user) => (
              <article
                key={user.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
                onClick={() => setDetails(user)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-slate-950">
                      {user.name}
                    </h2>
                    <p className="mt-0.5 text-sm text-blue-700">
                      {roleLabel(user.role)}
                    </p>
                  </div>
                  <Badge variant={STATUS_META[user.status].variant}>
                    {STATUS_META[user.status].label}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-slate-600" dir="ltr">
                  {user.username ?? user.email}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  פרויקטים: {user.projects.length}
                </p>
                <div
                  className="mt-4 border-t border-slate-100 pt-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <UserActions
                    user={user}
                    busy={busy}
                    onEdit={openEdit}
                    onDetails={setDetails}
                    onReset={(target) => {
                      setResetTarget(target);
                      setResetPassword(generatePassword());
                    }}
                    onStatus={changeStatus}
                    onDelete={setDeleteTarget}
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "עריכת משתמש" : "משתמש חדש"}
        description="ההרשאות נגזרות ממנגנון ה־RBAC הקיים"
        size="xl"
      >
        <form onSubmit={submitUser} className="space-y-6">
          <FormSection title="פרטים אישיים">
            <Field label="שם מלא *">
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3"
              />
            </Field>
            <Field label={form.role === "FIELD_MANAGER" ? "טלפון *" : "טלפון"}>
              <input
                required={form.role === "FIELD_MANAGER"}
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3"
                dir="ltr"
              />
            </Field>
            <Field label="אימייל">
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3"
                dir="ltr"
              />
            </Field>
          </FormSection>

          <FormSection title="פרטי כניסה">
            <Field label="שם משתמש *">
              <input
                required
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3"
                dir="ltr"
              />
            </Field>
            {!editing && (
              <>
                <Field label="סיסמה זמנית *">
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3"
                    dir="ltr"
                  />
                </Field>
                <Field label="אימות סיסמה *">
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={form.confirmPassword}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3"
                    dir="ltr"
                  />
                </Field>
                <button
                  type="button"
                  className="text-sm font-semibold text-blue-700"
                  onClick={() => {
                    const password = generatePassword();
                    setForm((current) => ({
                      ...current,
                      password,
                      confirmPassword: password,
                    }));
                  }}
                >
                  צור סיסמה אוטומטית
                </button>
              </>
            )}
          </FormSection>

          <FormSection title="תפקיד והרשאות">
            <Field label="סוג משתמש *">
              <select
                required
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value as ManagedUserRole,
                    projectIds: [],
                    allowNoProjects: false,
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3"
              >
                {MANAGED_USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_META[role].label}
                  </option>
                ))}
              </select>
            </Field>
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {ROLE_META[form.role].description}
            </p>
          </FormSection>

          {(form.role === "PROJECT_MANAGER" ||
            form.role === "FIELD_MANAGER") && (
            <FormSection
              title={
                form.role === "PROJECT_MANAGER"
                  ? "פרויקטים משויכים *"
                  : "פרויקטים / אתרי עבודה *"
              }
            >
              <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                {projects.map((project) => (
                  <label
                    key={project.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.projectIds.includes(project.id)}
                      onChange={() => toggleProject(project.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">
                        {project.name}
                      </span>
                      <span className="text-xs text-slate-500" dir="ltr">
                        {project.contractNumber}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {form.role === "PROJECT_MANAGER" && (
                <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    checked={form.allowNoProjects}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        allowNoProjects: event.target.checked,
                      }))
                    }
                    className="mt-1"
                  />
                  שמור ללא שיוך כרגע — המשתמש לא יוכל לנהל פרויקט עד לשיוך
                </label>
              )}
            </FormSection>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFormOpen(false)}
            >
              ביטול
            </Button>
            <Button type="submit" loading={busy}>
              {editing ? "שמור שינויים" : "צור משתמש"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={!!statusChange}
        onClose={() => {
          if (!busy) setStatusChange(null);
        }}
        onConfirm={confirmStatusChange}
        loading={busy}
        loadingLabel="מבצע פעולה…"
        variant={statusChange?.status === "ACTIVE" ? "primary" : "danger"}
        icon={statusChange?.status === "ARCHIVED" ? Archive : Power}
        title={
          statusChange?.status === "ACTIVE"
            ? "הפעלת משתמש מחדש"
            : statusChange?.status === "ARCHIVED"
              ? "העברת משתמש לארכיון"
              : "השבתת משתמש"
        }
        confirmLabel={
          statusChange?.status === "ACTIVE"
            ? "הפעל מחדש"
            : statusChange?.status === "ARCHIVED"
              ? "העבר לארכיון"
              : "השבת משתמש"
        }
        description={
          statusChange ? (
            <span>
              האם לבצע את הפעולה עבור{" "}
              <strong className="text-slate-900">
                {statusChange.user.name}
              </strong>
              {statusChange.user.username
                ? ` (${statusChange.user.username})`
                : ""}
              ?
            </span>
          ) : null
        }
        info={
          statusChange?.status === "ACTIVE"
            ? "המשתמש יוכל להתחבר מחדש בהתאם לתפקיד ולשיוכים הקיימים שלו."
            : statusChange?.status === "ARCHIVED"
              ? "המשתמש לא יימחק. הוא לא יוכל להתחבר ויוסתר מהרשימה הפעילה, אך כל המסמכים, השיוכים והיסטוריית ה־Audit יישמרו."
              : "המשתמש לא יוכל להתחבר וכל ה־Sessions הקיימים שלו יבוטלו. המסמכים, השיוכים והיסטוריית ה־Audit יישמרו."
        }
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        onClose={() => {
          if (!busy) setDeleteTarget(null);
        }}
        onConfirm={deletePermanently}
        loading={busy}
        loadingLabel="מוחק לצמיתות…"
        variant="danger"
        icon={Trash2}
        title="מחיקת משתמש לצמיתות"
        confirmLabel="מחק לצמיתות"
        description={
          deleteTarget ? (
            <span>
              האם למחוק לצמיתות את{" "}
              <strong className="text-slate-900">{deleteTarget.name}</strong>
              {deleteTarget.username ? ` (${deleteTarget.username})` : ""}?
            </span>
          ) : null
        }
        info="פעולה זו אינה ניתנת לביטול. פרטי המשתמש והיסטוריית הפעולות שביצע יימחקו. אם קיימים מסמכים, פרויקטים או רשומות עסקיות מקושרות, המערכת תחסום את המחיקה ותשאיר את המשתמש בארכיון."
      />

      <Modal
        open={!!details}
        onClose={() => setDetails(null)}
        title="פרטי משתמש"
        size="lg"
      >
        {details && <UserDetails user={details} />}
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="איפוס סיסמה"
        description={resetTarget?.name}
      >
        <form onSubmit={submitReset} className="space-y-4">
          <p className="text-sm text-slate-600">
            הסיסמה הישנה לא תוצג. הסיסמה הזמנית החדשה תופיע פעם אחת בלבד.
          </p>
          <input
            required
            minLength={8}
            type="password"
            value={resetPassword}
            onChange={(event) => setResetPassword(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 px-3"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => setResetPassword(generatePassword())}
            className="text-sm font-semibold text-blue-700"
          >
            צור סיסמה אוטומטית
          </button>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResetTarget(null)}
            >
              ביטול
            </Button>
            <Button type="submit" loading={busy}>
              איפוס סיסמה
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title="המשתמש נוצר בהצלחה"
        description="פרטי ההתחברות יוצגו פעם אחת בלבד"
      >
        {credentials && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">שם משתמש</p>
              <p className="mt-1 font-mono text-base" dir="ltr">
                {credentials.username}
              </p>
              <p className="mt-4 text-xs text-slate-500">סיסמה זמנית</p>
              <p className="mt-1 font-mono text-base" dir="ltr">
                {credentials.password}
              </p>
            </div>
            <Button className="w-full" onClick={() => void copyCredentials()}>
              <Copy className="h-4 w-4" />
              העתק פרטי כניסה
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function UserActions({
  user,
  busy,
  onEdit,
  onDetails,
  onReset,
  onStatus,
  onDelete,
}: {
  user: ManagedUser;
  busy: boolean;
  onEdit: (user: ManagedUser) => void;
  onDetails: (user: ManagedUser) => void;
  onReset: (user: ManagedUser) => void;
  onStatus: (user: ManagedUser, status: ManagedUserStatus) => void;
  onDelete: (user: ManagedUser) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="outline" onClick={() => onEdit(user)}>
        <Edit3 className="h-3.5 w-3.5" />
        עריכה
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onReset(user)}>
        <KeyRound className="h-3.5 w-3.5" />
        איפוס
      </Button>
      {user.status === "ACTIVE" ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onStatus(user, "DISABLED")}
          >
            <Power className="h-3.5 w-3.5" />
            השבתה
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onStatus(user, "ARCHIVED")}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onStatus(user, "ACTIVE")}
          >
            <Check className="h-3.5 w-3.5" />
            הפעל מחדש
          </Button>
          {user.status === "ARCHIVED" && (
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() => onDelete(user)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              מחיקה לצמיתות
            </Button>
          )}
        </>
      )}
      <Button size="sm" variant="ghost" onClick={() => onDetails(user)}>
        <MoreVertical className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function UserDetails({ user }: { user: ManagedUser }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100">
          <UserRound className="h-6 w-6 text-slate-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-950">{user.name}</h3>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={STATUS_META[user.status].variant}>
              {STATUS_META[user.status].label}
            </Badge>
            <span className="text-sm text-slate-500">
              {roleLabel(user.role)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <Detail label="Username" value={user.username ?? "—"} ltr />
        <Detail label="Email" value={user.email} ltr />
        <Detail label="טלפון" value={user.phone ?? "—"} ltr />
        <Detail label="כניסה אחרונה" value={formatDate(user.lastLoginAt)} />
        <Detail label="נוצר" value={formatDate(user.createdAt)} />
        <Detail
          label="הפניות עסקיות"
          value={String(user.businessReferenceCount)}
        />
      </div>

      <section>
        <h4 className="mb-2 flex items-center gap-2 font-bold text-slate-900">
          <Shield className="h-4 w-4" />
          תפקיד והרשאות
        </h4>
        <p className="text-sm text-slate-600">
          {ROLE_META[user.role as ManagedUserRole]?.description ??
            "Role לא נתמך במערכת הניהול"}
        </p>
      </section>

      <section>
        <h4 className="mb-2 font-bold text-slate-900">פרויקטים</h4>
        {user.projects.length ? (
          <div className="flex flex-wrap gap-2">
            {user.projects.map((project) => (
              <span
                key={project.id}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              >
                {project.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">אין פרויקטים משויכים</p>
        )}
      </section>

      <section>
        <h4 className="mb-2 font-bold text-slate-900">פעילות אחרונה</h4>
        {user.recentActions.length ? (
          <div className="space-y-2">
            {user.recentActions.map((action) => (
              <div
                key={action.id}
                className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"
              >
                <span>{action.action}</span>
                <span className="text-slate-500">
                  {formatDate(action.createdAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">אין פעילות להצגה</p>
        )}
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900" dir={ltr ? "ltr" : "rtl"}>
        {value}
      </p>
    </div>
  );
}
