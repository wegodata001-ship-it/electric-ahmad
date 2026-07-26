import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/config/storage";
import { getRequiredSecret } from "@/lib/env/required-secrets";

function requireSupabaseUrl(): string {
  if (!supabaseConfig.url) {
    throw new Error(
      "כתובת Supabase חסרה: יש להגדיר NEXT_PUBLIC_SUPABASE_URL / " +
        "Missing NEXT_PUBLIC_SUPABASE_URL — Supabase client cannot be created."
    );
  }
  return supabaseConfig.url;
}

export function createSupabaseAdmin() {
  const url = requireSupabaseUrl();
  const serviceRoleKey = getRequiredSecret("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createSupabaseServer() {
  const url = requireSupabaseUrl();
  const anonKey = getRequiredSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
