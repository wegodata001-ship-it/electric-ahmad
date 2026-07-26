export type AttendancePolicy =
  | "optional"
  | "before_diary"
  | "before_all_actions";

export const ATTENDANCE_POLICY_KEY = "attendance_policy";

export const ATTENDANCE_POLICY_LABELS: Record<AttendancePolicy, string> = {
  optional: "כניסה לעבודה אינה חובה",
  before_diary: "חובה לפני יצירת יומן / תעודת משלוח",
  before_all_actions: "חובה לפני כל פעולה (התחל עבודה / יומן / תעודה)",
};

export function parseAttendancePolicy(value?: string | null): AttendancePolicy {
  if (value === "before_diary" || value === "before_all_actions") return value;
  return "optional";
}
