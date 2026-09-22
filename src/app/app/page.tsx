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
      <h1 className="text-2xl font-semibold">Welcome, {user?.email}</h1>
      <div className="flex w-full flex-col gap-4 sm:flex-row">
        <Link
          href="/app/laning"
          className="flex-1 rounded-lg border border-black/[.08] px-5 py-4 text-left dark:border-white/[.145]"
        >
          <span className="font-medium">Laning Advisor</span>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Buy order for your hero, your lane partner, and the enemy laner(s).
          </p>
        </Link>
        <Link
          href="/app/itemization"
          className="flex-1 rounded-lg border border-black/[.08] px-5 py-4 text-left dark:border-white/[.145]"
        >
          <span className="font-medium">Itemization Advisor</span>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Full-match itemization plan against the whole enemy team.
          </p>
        </Link>
        <Link
          href="/app/review/new"
          className="flex-1 rounded-lg border border-black/[.08] px-5 py-4 text-left dark:border-white/[.145]"
        >
          <span className="font-medium">Post-Match Review</span>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Coach review of a finished match, with an option to publish a shareable link.
          </p>
        </Link>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-full border border-black/[.08] px-5 py-3 text-sm font-medium dark:border-white/[.145]"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
