import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "@/config/storage";

export function createSupabaseClient() {
  return createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey);
}
