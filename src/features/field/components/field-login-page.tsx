"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function FieldLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/field/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "התחברות נכשלה");
      }
      const next = searchParams.get("next") || "/field";
      router.replace(next.startsWith("/field") ? next : "/field");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-[#F7F8FA] px-4"
      dir="rtl"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-sm"
      >
        <div className="mb-2 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white">
            WG
          </div>
          <h1 className="text-2xl font-black text-[#111827]">עבודה בשטח</h1>
          <p className="mt-1 text-base text-[#6B7280]">
            התחברות מנהל עבודה
          </p>
        </div>

        <div>
          <label className="mb-2 block text-base font-bold text-[#111827]">
            שם משתמש
          </label>
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full min-h-14 rounded-2xl border border-[#E5E7EB] px-4 text-lg"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-base font-bold text-[#111827]">
            סיסמה
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-14 rounded-2xl border border-[#E5E7EB] px-4 text-lg"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-16 w-full rounded-2xl bg-blue-600 text-xl font-black text-white disabled:opacity-50"
        >
          {loading ? "מתחבר..." : "התחברות"}
        </button>
      </form>
    </div>
  );
}
