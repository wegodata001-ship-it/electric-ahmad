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
    <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white border border-gray-200 p-6 space-y-4"
      >
        <div className="text-center mb-2">
          <div className="mx-auto h-12 w-12 rounded-md bg-[#1e40af] text-white flex items-center justify-center font-bold mb-3">
            WG
          </div>
          <h1 className="text-xl font-bold text-gray-900">WEGO Field</h1>
          <p className="text-sm text-gray-500 mt-1">
            התחברות מנהל עבודה בלבד
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">
            שם משתמש
          </label>
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full min-h-12 border border-gray-300 rounded-xl px-3 text-base"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">סיסמה</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-12 border border-gray-300 rounded-xl px-3 text-base"
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
          className="w-full h-14 rounded-2xl bg-[#1e40af] text-white text-lg font-bold disabled:opacity-50"
        >
          {loading ? "מתחבר..." : "התחברות"}
        </button>
      </form>
    </div>
  );
}
