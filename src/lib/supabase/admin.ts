import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely.
 *
 * Server-only. Never import this from a Client Component, a file with
 * "use client", or anything that could end up in a browser bundle — it
 * holds SUPABASE_SERVICE_ROLE_KEY. Restricted to trusted server-side jobs:
 * stats_cache writes and the hero/item document seed script.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
