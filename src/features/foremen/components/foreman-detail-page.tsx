"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Card, Button, Tabs } from "@/components/ui";
import {
  foremenService,
  type ForemanDetail,
} from "@/features/foremen/services/foremen.service";
import { formatDate, formatNumber } from "@/utils/format";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

export function ForemanDetailPage({ foremanId }: { foremanId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "journals";
  const [tab, setTab] = useState(initialTab);
  const [data, setData] = useState<ForemanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTab(searchParams.get("tab") || "journals");
  }, [searchParams]);

  useEffect(() => {
    foremenService
      .getById(foremanId)
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "שגיאה בטעינה")
      );
  }, [foremanId]);

  if (error) {
    return (
      <Card padding="lg">
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return <p className="text-sm text-gray-400">טוען כרטיס מנהל עבודה...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.push("/foremen")}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה למנהלי עבודה
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">{data.fullName}</h1>
          <Badge
            className={
              data.isDeleted
                ? "bg-red-50 text-red-700"
                : data.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gray-100 text-gray-600"
            }
          >
            {data.isDeleted
              ? "נמחק"
              : data.status === "active"
                ? "פעיל"
                : "מושבת"}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 mt-1" dir="ltr">
          {data.phone} · {data.email}
          {data.username ? ` · @${data.username}` : ""}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          נוצר: {formatDate(data.createdAt || data.joinedAt)}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Mini label="פרויקטים פעילים" value={data.stats.activeProjects} />
        <Mini label="יומנים" value={data.stats.journalsCount} />
        <Mini label="דיווחים" value={data.stats.reportsCount} />
        <Mini label="עובדים פעילים" value={data.stats.activeCrew} />
        <Mini
          label="שעות החודש"
          value={formatNumber(data.stats.hoursThisMonth, 1)}
        />
        <Mini
          label="שעות השנה"
          value={formatNumber(data.stats.hoursThisYear, 1)}
        />
      </div>

      {data.notes && (
        <Card padding="md">
          <p className="text-xs text-gray-500 mb-1">הערות</p>
          <p className="text-sm text-gray-800">{data.notes}</p>
        </Card>
      )}

      <Card padding="lg">
        <h2 className="text-base font-semibold mb-3">פרויקטים</h2>
        <div className="space-y-2">
          {data.projects.map((p) => (
            <div
              key={p.id}
              className="flex justify-between text-sm py-2 border-b border-gray-50"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-gray-400">{p.location}</span>
            </div>
          ))}
          {data.projects.length === 0 && (
            <p className="text-sm text-gray-400">אין פרויקטים</p>
          )}
        </div>
      </Card>

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: "journals", label: "יומני עבודה", count: data.journals.length },
          {
            id: "reports",
            label: "דיווחים",
            count: (data.dailyReports || []).length,
          },
          { id: "crew", label: "עובדים", count: (data.crew || []).length },
          {
            id: "media",
            label: "תמונות",
            count: data.media.filter((m) => m.type === "image").length,
          },
          {
            id: "history",
            label: "היסטוריה",
            count: data.activities.length,
          },
        ]}
      />

      {tab === "journals" && (
        <Card padding="lg">
          <div className="space-y-4">
            {data.journals.map((j) => (
              <div
                key={j.id}
                className="border border-gray-100 rounded-lg p-3 space-y-2"
              >
                <div className="flex justify-between gap-2 flex-wrap">
                  <p className="font-medium text-gray-900">
                    {formatDate(j.date)} · {j.projectName}
                  </p>
                  <Badge
                    className={
                      j.status === "submitted"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-800"
                    }
                  >
                    {j.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {j.clientName} · {j.address}
                </p>
                {j.actionsPerformed && (
                  <p className="text-sm text-gray-700">{j.actionsPerformed}</p>
                )}
                <p className="text-xs text-gray-400">
                  {j.workers.length} עובדים
                  {j.submittedAt
                    ? ` · נשלח ${new Date(j.submittedAt).toLocaleString("he-IL")}`
                    : ""}
                </p>
              </div>
            ))}
            {data.journals.length === 0 && (
              <p className="text-sm text-gray-400">אין יומני עבודה</p>
            )}
          </div>
        </Card>
      )}

      {tab === "reports" && (
        <Card padding="lg">
          <div className="flex justify-between mb-3">
            <h2 className="text-base font-semibold">דיווחים שנשלחו</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                router.push(`/reports?foremanId=${data.id}`)
              }
            >
              כל הדיווחים
            </Button>
          </div>
          <div className="space-y-2">
            {(data.dailyReports || []).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => router.push(`/reports/${r.id}`)}
                className="w-full text-right border border-gray-100 rounded-lg px-3 py-2 hover:bg-gray-50"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    {formatDate(r.date)} · {r.projectName}
                  </span>
                  <Badge className="bg-amber-50 text-amber-800">{r.status}</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {r.workersCount} עובדים · {formatNumber(r.totalHours, 1)} שעות
                  · {new Date(r.submittedAt).toLocaleString("he-IL")}
                </p>
              </button>
            ))}
            {(data.dailyReports || []).length === 0 && (
              <p className="text-sm text-gray-400">אין דיווחים עדיין</p>
            )}
          </div>
        </Card>
      )}

      {tab === "crew" && (
        <Card padding="lg">
          <div className="space-y-2">
            {(data.crew || []).map((c) => (
              <div
                key={c.id}
                className="flex justify-between text-sm py-2 border-b border-gray-50"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {c.profession} · {c.phone}
                  </p>
                </div>
                <Badge
                  className={
                    c.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-600"
                  }
                >
                  {c.status}
                </Badge>
              </div>
            ))}
            {(data.crew || []).length === 0 && (
              <p className="text-sm text-gray-400">אין עובדים ברשימה האישית</p>
            )}
          </div>
        </Card>
      )}

      {tab === "media" && (
        <Card padding="lg">
          <div className="flex flex-wrap gap-2">
            {data.media
              .filter((m) => m.type === "image")
              .map((m) => (
                <div
                  key={m.id}
                  className="relative h-20 w-20 rounded-lg overflow-hidden border"
                >
                  <Image
                    src={m.url}
                    alt={m.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ))}
            {data.media.filter((m) => m.type === "image").length === 0 && (
              <p className="text-sm text-gray-400">אין תמונות</p>
            )}
          </div>
        </Card>
      )}

      {tab === "history" && (
        <Card padding="lg">
          <div className="space-y-3">
            {data.activities.map((a) => (
              <div key={a.id} className="text-sm border-b border-gray-50 pb-2">
                <p className="font-medium text-gray-900">{a.title}</p>
                <p className="text-gray-600">{a.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(a.createdAt).toLocaleString("he-IL")}
                </p>
              </div>
            ))}
            {data.activities.length === 0 && (
              <p className="text-sm text-gray-400">אין היסטוריה</p>
            )}
          </div>
        </Card>
      )}

      <Card padding="md">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open("/field/login", "_blank")}
        >
          קישור התחברות לשטח
        </Button>
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
