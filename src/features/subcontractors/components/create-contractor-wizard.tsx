"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui";
import { ENGAGEMENT_LABELS } from "@/lib/subcontractors/constants";

type Project = { id: string; name: string };
type Site = { id: string; name: string };

export function CreateContractorWizard({
  cardHref,
  onClose,
}: {
  cardHref: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [details, setDetails] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    taxId: "",
    specialty: "",
  });
  const [assign, setAssign] = useState({
    skip: false,
    projectId: "",
    workSiteId: "",
    description: "",
    startDate: "",
    engagementType: "mixed",
    amount: "",
  });
  const [access, setAccess] = useState({
    open: true,
    contactName: "",
    email: "",
    portalRole: "owner",
  });

  useEffect(() => {
    apiClient
      .get<Project[] | { items?: Project[] }>("/api/projects")
      .then((r) => setProjects(Array.isArray(r) ? r : r.items ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!assign.projectId) {
      setSites([]);
      return;
    }
    apiClient
      .get<{ items?: Site[] } | Site[]>(`/api/projects/${assign.projectId}/work-sites`)
      .then((r) => setSites(Array.isArray(r) ? r : r.items ?? []))
      .catch(() => setSites([]));
  }, [assign.projectId]);

  async function finish() {
    setSaving(true);
    setError("");
    try {
      const created = await apiClient.post<{ id: string }>("/api/subcontractors", details);
      if (!assign.skip && assign.projectId && assign.description.trim()) {
        await apiClient.post(`/api/subcontractors/${created.id}/assignments`, {
          projectId: assign.projectId,
          workSiteId: assign.workSiteId || null,
          description: assign.description,
          startDate: assign.startDate || null,
          engagementType: assign.engagementType,
          amount: assign.amount ? Number(assign.amount) : null,
        });
      }
      if (access.open) {
        const invite = await apiClient.post<{ activationUrl: string }>(
          `/api/subcontractors/${created.id}/access`,
          {
            email: access.email || details.email,
            contactName: access.contactName || details.contactName,
            portalRole: access.portalRole,
          }
        );
        setInviteUrl(invite.activationUrl);
      }
      setCreatedId(created.id);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "יצירת הקבלן נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-3 sm:items-center sm:justify-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5" dir="rtl">
        <p className="text-xs font-bold text-slate-400">שלב {Math.min(step, 3)} מתוך 3</p>
        {step === 1 && (
          <>
            <h3 className="mb-3 text-lg font-black">פרטי הקבלן</h3>
            {(
              [
                ["companyName", "שם עסק / קבלן"],
                ["contactName", "איש קשר"],
                ["phone", "טלפון"],
                ["email", "אימייל"],
                ["taxId", "מספר עוסק / חברה"],
                ["specialty", "סוג התמחות"],
              ] as const
            ).map(([key, label]) => (
              <input
                key={key}
                className="mb-2 w-full rounded-xl border px-3 py-3 text-sm"
                placeholder={label}
                value={details[key]}
                onChange={(e) => setDetails((p) => ({ ...p, [key]: e.target.value }))}
              />
            ))}
            <div className="mt-3 flex gap-2">
              <Button
                className="min-h-12 flex-1"
                onClick={() => {
                  if (!details.companyName.trim() || !details.contactName.trim() || !details.phone.trim() || !details.email.trim()) {
                    setError("יש למלא שם, איש קשר, טלפון ואימייל");
                    return;
                  }
                  setError("");
                  setAccess((p) => ({
                    ...p,
                    contactName: p.contactName || details.contactName,
                    email: p.email || details.email,
                  }));
                  setStep(2);
                }}
              >
                המשך
              </Button>
              <Button variant="secondary" onClick={onClose}>
                ביטול
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="mb-3 text-lg font-black">הקצאת פרויקט</h3>
            <p className="mb-3 text-sm text-slate-500">אפשר לדלג ולהקצות מאוחר יותר.</p>
            <select
              className="mb-2 w-full rounded-xl border px-3 py-3 text-sm"
              value={assign.projectId}
              onChange={(e) => setAssign((p) => ({ ...p, projectId: e.target.value, skip: false }))}
            >
              <option value="">בחירת פרויקט</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {sites.length > 0 && (
              <select
                className="mb-2 w-full rounded-xl border px-3 py-3 text-sm"
                value={assign.workSiteId}
                onChange={(e) => setAssign((p) => ({ ...p, workSiteId: e.target.value }))}
              >
                <option value="">סניף עבודה (אופציונלי)</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <input
              className="mb-2 w-full rounded-xl border px-3 py-3 text-sm"
              placeholder="סוג עבודה / תיאור"
              value={assign.description}
              onChange={(e) => setAssign((p) => ({ ...p, description: e.target.value }))}
            />
            <input
              type="date"
              className="mb-2 w-full rounded-xl border px-3 py-3 text-sm"
              value={assign.startDate}
              onChange={(e) => setAssign((p) => ({ ...p, startDate: e.target.value }))}
            />
            <select
              className="mb-2 w-full rounded-xl border px-3 py-3 text-sm"
              value={assign.engagementType}
              onChange={(e) => setAssign((p) => ({ ...p, engagementType: e.target.value }))}
            >
              {Object.entries(ENGAGEMENT_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <input
              className="mb-2 w-full rounded-xl border px-3 py-3 text-sm"
              placeholder="סכום או מחירון (אופציונלי)"
              value={assign.amount}
              onChange={(e) => setAssign((p) => ({ ...p, amount: e.target.value }))}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="min-h-12" onClick={() => setStep(3)}>
                המשך
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setAssign((p) => ({ ...p, skip: true }));
                  setStep(3);
                }}
              >
                דלג
              </Button>
              <Button variant="ghost" onClick={() => setStep(1)}>
                חזרה
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="mb-3 text-lg font-black">גישה למערכת</h3>
            <p className="mb-3 text-sm text-slate-600">האם לפתוח לקבלן גישה למערכת?</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`min-h-12 rounded-xl border text-sm font-bold ${access.open ? "bg-slate-900 text-white" : "bg-white"}`}
                onClick={() => setAccess((p) => ({ ...p, open: true }))}
              >
                כן, שלח הזמנה
              </button>
              <button
                type="button"
                className={`min-h-12 rounded-xl border text-sm font-bold ${!access.open ? "bg-slate-900 text-white" : "bg-white"}`}
                onClick={() => setAccess((p) => ({ ...p, open: false }))}
              >
                לא כרגע
              </button>
            </div>
            {access.open && (
              <>
                <input
                  className="mb-2 w-full rounded-xl border px-3 py-3 text-sm"
                  placeholder="שם איש קשר"
                  value={access.contactName}
                  onChange={(e) => setAccess((p) => ({ ...p, contactName: e.target.value }))}
                />
                <input
                  className="mb-2 w-full rounded-xl border px-3 py-3 text-sm"
                  placeholder="אימייל התחברות"
                  value={access.email}
                  onChange={(e) => setAccess((p) => ({ ...p, email: e.target.value }))}
                />
                <p className="mb-2 text-xs text-slate-500">
                  תיווצר הזמנה מאובטחת. הסיסמה לא נשלחת ולא נשמרת בגלוי.
                </p>
              </>
            )}
            <div className="mt-3 flex gap-2">
              <Button className="min-h-12 flex-1" loading={saving} onClick={() => void finish()}>
                יצירת קבלן
              </Button>
              <Button variant="ghost" onClick={() => setStep(2)}>
                חזרה
              </Button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h3 className="mb-2 text-lg font-black">הקבלן נוצר בהצלחה</h3>
            {inviteUrl ? (
              <p className="mb-3 break-all rounded-xl bg-amber-50 p-3 text-xs">
                קישור להגדרת סיסמה: {inviteUrl}
              </p>
            ) : (
              <p className="mb-3 text-sm text-slate-500">לא נפתחה גישה. אפשר לפתוח מאוחר יותר מכרטיס הקבלן.</p>
            )}
            <div className="grid gap-2">
              <Button className="min-h-12" onClick={() => router.push(`${cardHref}/${createdId}`)}>
                פתח כרטיס קבלן
              </Button>
              <Button
                variant="secondary"
                className="min-h-12"
                onClick={() => router.push(`${cardHref}/${createdId}`)}
              >
                הקצה עבודה
              </Button>
              <Button variant="ghost" onClick={onClose}>
                חזור לקבלני משנה
              </Button>
            </div>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
