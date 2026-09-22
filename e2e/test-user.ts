import { createClient } from "@supabase/supabase-js";

// Test-only accounts, created and deleted by name-scoped id — never a
// blanket "delete all users" sweep. See project memory:
// never-blanket-delete-test-users.
//
// This intentionally does NOT import createAdminClient from
// src/lib/supabase/admin.ts, even though it constructs an equivalent
// client — verified live that admin.ts's `import "server-only"` throws
// unconditionally when loaded outside Next.js's build pipeline (Next
// swaps in a no-op version only for its own server bundles; Playwright
// runs test files directly through Node, with no such substitution).
// Options are kept in sync with admin.ts by hand instead.
export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createTestUser() {
  const admin = adminClient();
  const email = `playwright-test+${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = "playwright-test-password-123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create Playwright test user: ${error?.message}`);
  }
  return { email, password, userId: data.user.id };
}

export async function deleteTestUser(userId: string) {
  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    // Surface this loudly rather than swallowing it — a silently failed
    // cleanup leaves an orphaned playwright-test+ account with no signal
    // in CI logs, accumulating across repeated runs.
    throw new Error(`Failed to delete Playwright test user ${userId}: ${error.message}`);
  }
}
