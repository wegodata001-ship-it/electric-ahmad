"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { COMPANY_PROFILE } from "@/config/company";

const LOGIN_BRAND_NAME = "מערכת חשמל הזם";
const LOGIN_BRAND_MARK = "הזם";

function safeBrandName(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return LOGIN_BRAND_NAME;
  // Reject mojibake (Hebrew geresh spam from bad Windows/env encoding)
  if ((v.match(/\u05F3/g) || []).length >= 2) return LOGIN_BRAND_NAME;
  return v;
}

function safeBrandMark(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return LOGIN_BRAND_MARK;
  if ((v.match(/\u05F3/g) || []).length >= 2) return LOGIN_BRAND_MARK;
  return v;
}

export function OfficeLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const brandName = safeBrandName(COMPANY_PROFILE.name);
  const brandMark = safeBrandMark(COMPANY_PROFILE.logoText);
  const [logoFailed, setLogoFailed] = useState(false);

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
      const portalPath =
        typeof json.data?.portalPath === "string"
          ? json.data.portalPath
          : null;
      const next = searchParams.get("next");
      const safeNext =
        next &&
        next.startsWith("/") &&
        !next.startsWith("//") &&
        !next.startsWith("/api") &&
        next !== "/login" &&
        next !== "/field/login"
          ? next
          : null;
      const dest = safeNext || portalPath || "/login";
      router.replace(dest);
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
          {COMPANY_PROFILE.logoUrl && !logoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={COMPANY_PROFILE.logoUrl}
              alt={brandName}
              className="mx-auto mb-3 h-14 w-14 rounded-xl object-cover"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl text-sm font-bold tracking-wide text-white"
              style={{ background: COMPANY_PROFILE.brandBlue }}
            >
              {brandMark}
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{brandName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            התחברות אחת · הפניה אוטומטית ל־Portal
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
            placeholder="admin / pm1 / sysmgr…"
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
            className="w-full h-11 border border-gray-200 rounded-xl px-3 text-sm"
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
      </form>
    </div>
  );
}
