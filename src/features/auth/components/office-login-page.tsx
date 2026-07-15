"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { COMPANY_PROFILE } from "@/config/company";

export function OfficeLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, rememberMe }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "התחברות נכשלה");
      }
      const next = searchParams.get("next") || "/dashboard";
      const safeNext =
        next.startsWith("/") &&
        !next.startsWith("//") &&
        !next.startsWith("/field") &&
        !next.startsWith("/api")
          ? next === "/project-manager" || next === "/login"
            ? "/dashboard"
            : next
          : "/dashboard";
      router.replace(safeNext);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background:
          "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #e0e7ff 100%)",
      }}
      dir="rtl"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-sm p-7 space-y-4"
      >
        <div className="text-center mb-1">
          <div
            className="mx-auto h-14 w-14 rounded-xl text-white flex items-center justify-center font-bold text-sm tracking-wide mb-3"
            style={{ background: COMPANY_PROFILE.brandBlue }}
          >
            {COMPANY_PROFILE.logoText || "ERP"}
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {COMPANY_PROFILE.name || "מערכת ניהול"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            התחברות מנהל פרויקט / מערכת ניהול
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            שם משתמש / אימייל
          </label>
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin או office@..."
            className="w-full h-11 border border-gray-300 rounded-xl px-3 text-sm"
            required
            dir="ltr"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">סיסמה</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 border border-gray-300 rounded-xl px-3 text-sm"
            required
            dir="ltr"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          זכור אותי
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl text-white text-base font-bold disabled:opacity-50"
          style={{ background: COMPANY_PROFILE.brandBlue }}
        >
          {loading ? "מתחבר..." : "התחבר"}
        </button>

        <p className="text-center text-xs text-gray-400 pt-1">
          מנהלי עבודה בשטח:{" "}
          <a href="/field/login" className="text-blue-700 underline">
            התחברות שטח
          </a>
        </p>
      </form>
    </div>
  );
}
