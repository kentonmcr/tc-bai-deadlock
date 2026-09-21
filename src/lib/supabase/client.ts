import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components. Uses only the anon key —
 * RLS policies, not this client, are what actually restrict access.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
