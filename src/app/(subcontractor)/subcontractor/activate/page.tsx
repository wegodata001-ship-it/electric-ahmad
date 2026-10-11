"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui";
import { BrandLogo, BrandWordmark } from "@/components/brand/brand-logo";

function ActivateForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function submit() {
    setError("");
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    try {
      await apiClient.post("/api/subcontractor/auth/activate", { token, password });
      setOk(true);
      setTimeout(() => router.replace("/login"), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ההפעלה נכשלה");
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-3 rounded-2xl bg-white p-5 shadow" dir="rtl">
      <BrandLogo height={44} maxWidth={180} />
      <BrandWordmark />
      <h1 className="text-xl font-black">הפעלת חשבון קבלן משנה</h1>
      <p className="text-sm text-slate-500">בחרו סיסמה אישית. הסיסמה לא נשלחת ולא נשמרת בגלוי.</p>
      <input
        type="password"
        className="w-full rounded-xl border px-3 py-3"
        placeholder="סיסמה חדשה"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="password"
        className="w-full rounded-xl border px-3 py-3"
        placeholder="אימות סיסמה"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-emerald-700">החשבון הופעל. מעבירים להתחברות…</p>}
      <Button className="min-h-12 w-full" onClick={() => void submit()}>
        הפעל חשבון
      </Button>
    </div>
  );
}

export default function Page() {
  return (
    <div className="flex min-h-dvh items-center bg-[#FFF7ED] p-4">
      <Suspense fallback={<p>טוען…</p>}>
        <ActivateForm />
      </Suspense>
    </div>
  );
}
