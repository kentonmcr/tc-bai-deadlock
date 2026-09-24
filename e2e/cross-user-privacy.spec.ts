import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createTestUser, deleteTestUser, adminClient } from "./test-user";

/**
 * Cross-user privacy check: seeds a private advisor_sessions row for one
 * user, then confirms a second, unrelated authenticated user cannot read
 * it. Goes through the real anon-key client (the same one the running app
 * uses), not the admin/service-role client — this exercises the actual
 * Row Level Security policy the app depends on, not a bypassed check.
 */
test("a second user cannot read another user's saved advisor session via RLS", async () => {
  const owner = await createTestUser();
  const intruder = await createTestUser();

  try {
    const admin = adminClient();
    const { data: inserted, error: insertError } = await admin
      .from("advisor_sessions")
      .insert({
        user_id: owner.userId,
        advisor_type: "match",
        input: { probe: true },
        advice: "private test content that must not leak to another user",
        model: "test",
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      throw new Error(`Failed to seed owner's row: ${insertError?.message}`);
    }

    const intruderClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error: signInError } = await intruderClient.auth.signInWithPassword({
      email: intruder.email,
      password: intruder.password,
    });
    if (signInError) {
      throw new Error(`Failed to sign in as intruder: ${signInError.message}`);
    }

    const { data: leaked, error: readError } = await intruderClient
      .from("advisor_sessions")
      .select("id, advice")
      .eq("id", inserted.id);

    // RLS should silently filter the row out entirely — zero rows, not an
    // error and not the data. A 42501-style error would mean RLS is
    // misconfigured to deny at the statement level rather than filter rows;
    // actual leaked data would mean RLS is missing or wrong.
    expect(readError).toBeNull();
    expect(leaked).toEqual([]);
  } finally {
    await deleteTestUser(owner.userId);
    await deleteTestUser(intruder.userId);
  }
});
