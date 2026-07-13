import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/config/storage";

export function createSupabaseAdmin() {
  return createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createSupabaseServer() {
  return createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
