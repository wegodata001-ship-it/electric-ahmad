"use client";

import { useEffect, useState } from "react";
import { Card, Button, useToast } from "@/components/ui";
import { apiClient } from "@/lib/api/client";
import {
  ATTENDANCE_POLICY_LABELS,
  type AttendancePolicy,
} from "@/lib/settings/attendance-policy";
import { Shield, Clock } from "lucide-react";

export function SettingsPage() {
  const toast = useToast();
  const [policy, setPolicy] = useState<AttendancePolicy>("optional");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ attendancePolicy: AttendancePolicy }>("/api/system/settings")
      .then((d) => setPolicy(d.attendancePolicy))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [toast]);

  async function save() {
    setSaving(true);
    try {
      await apiClient.put("/api/system/settings", {
        attendancePolicy: policy,
      });
      toast.success("ההגדרה נשמרה");
    } catch (e: any) {
      toast.error(e?.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">הגדרות מערכת</h1>
        <p className="mt-1 text-sm text-gray-500">
          מדיניות נוכחות וכללי ארגון — לא ממשק שטח
        </p>
      </div>

      <Card padding="lg">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-400" />
          <h3 className="text-base font-semibold text-gray-900">
            Attendance Policy — מדיניות נוכחות
          </h3>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          מנהל עבודה תמיד יכול לצפות בסידורים ואישורים בלי כניסה. ההגדרה קובעת
          מתי המערכת תבקש כניסה לפני פעולה.
        </p>
        {loading ? (
          <p className="text-sm text-gray-400">טוען…</p>
        ) : (
          <div className="space-y-3">
            {(
              Object.keys(ATTENDANCE_POLICY_LABELS) as AttendancePolicy[]
            ).map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name="attendance"
                  className="mt-1"
                  checked={policy === key}
                  onChange={() => setPolicy(key)}
                />
                <span>
                  <span className="block font-semibold text-gray-900">
                    {ATTENDANCE_POLICY_LABELS[key]}
                  </span>
                </span>
              </label>
            ))}
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "שומר…" : "שמירת מדיניות"}
            </Button>
          </div>
        )}
      </Card>

      <Card padding="lg">
        <div className="mb-2 flex items-center gap-2">
          <Shield className="h-5 w-5 text-gray-400" />
          <h3 className="text-base font-semibold text-gray-900">הערה</h3>
        </div>
        <p className="text-sm text-gray-500">
          הגדרות מתקדמות (משתמשים, הרשאות, Workflow) נמצאות בתפריט System
          Portal — לא באפליקציות השטח/תפעול.
        </p>
      </Card>
    </div>
  );
}
