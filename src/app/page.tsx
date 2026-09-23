import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/app");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-accent">Deadlock Coach</h1>
      <p className="max-w-md text-muted">
        AI-powered laning, itemization, and post-match coaching for Deadlock —
        grounded in live matchup data, not guesses.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-full bg-accent px-5 py-3 text-sm font-medium text-background transition hover:bg-accent-strong"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:border-accent"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
