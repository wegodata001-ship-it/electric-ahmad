"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { COMPANY_PROFILE } from "@/config/company";
import {
  landingPathForSession,
  sessionKindForRole,
} from "@/lib/auth/login-redirect";

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
      const role = typeof json.data?.role === "string" ? json.data.role : undefined;
      const dest = landingPathForSession(
        sessionKindForRole(role),
        role,
        searchParams.get("next")
      );
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
      className="flex min-h-dvh items-center justify-center overflow-x-hidden px-4"
      style={{
        background:
          "linear-gradient(160deg, #fdecee 0%, #f6f7f8 48%, #ffffff 100%)",
      }}
      dir="rtl"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-[#E6E8EB] bg-white p-7 shadow-sm"
      >
        <div className="mb-1 text-center">
          <BrandLogo className="mx-auto mb-4" height={56} maxWidth={220} />
          <h1 className="text-xl font-black text-[#111111]">{COMPANY_PROFILE.name}</h1>
          <p className="mt-1 text-sm text-[#5B6470]">מערכת ניהול פרויקטי חשמל</p>
        </div>

        <div>
          <label className="mb-1 block text-sm text-[#5B6470]">
            שם משתמש / אימייל
          </label>
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="שם משתמש או אימייל"
            className="h-12 w-full rounded-xl border border-[#E6E8EB] px-3 text-sm"
            required
            dir="ltr"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[#5B6470]">סיסמה</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-xl border border-[#E6E8EB] px-3 text-sm"
            required
            dir="ltr"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-[#5B6470]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          זכור אותי
        </label>

        {error && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-xl text-base font-bold text-white disabled:opacity-50"
          style={{ background: "#C8102E" }}
        >
          {loading ? "מתחבר..." : "כניסה"}
        </button>
      </form>
    </div>
  );
}
