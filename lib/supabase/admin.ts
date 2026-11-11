import { createClient } from "@supabase/supabase-js";

/**
 * SERVER ONLY. Uses the service role key, which bypasses RLS and can manage auth users
 * and private storage. Never import this from a Client Component.
 */
export function createSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
