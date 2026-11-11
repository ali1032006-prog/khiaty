"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser client. Uses the public anon key; everything it can see is limited by RLS. */
export function createSupabaseBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
