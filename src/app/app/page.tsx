import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold text-accent">Welcome, {user?.email}</h1>
      <div className="flex w-full flex-col gap-4 sm:flex-row">
        <Link
          href="/app/match"
          className="flex-1 rounded-lg border border-border px-5 py-4 text-left transition hover:border-accent"
        >
          <span className="font-medium">Match Advisor</span>
          <p className="text-sm text-muted">
            Set the full 6v6 draft — a laning buy order for your lane, plus a full itemization
            plan against the enemy team.
          </p>
        </Link>
        <Link
          href="/app/review/new"
          className="flex-1 rounded-lg border border-border px-5 py-4 text-left transition hover:border-accent"
        >
          <span className="font-medium">Post-Match Review</span>
          <p className="text-sm text-muted">
            Coach review of a finished match, with an option to publish a shareable link.
          </p>
        </Link>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-full border border-border px-5 py-3 text-sm font-medium transition hover:border-accent"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
