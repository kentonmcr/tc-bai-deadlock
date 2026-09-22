import { createClient } from "@supabase/supabase-js";

// Test-only accounts, created and deleted by name-scoped id — never a
// blanket "delete all users" sweep. See project memory:
// never-blanket-delete-test-users.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
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
  await admin.auth.admin.deleteUser(userId);
}
