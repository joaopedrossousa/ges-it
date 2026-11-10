import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

import { configSupabase } from "./env";

/** Cliente Supabase para Client Components (navegador). */
export function createClient() {
  const { url, chave } = configSupabase();
  return createBrowserClient<Database>(url, chave);
}
