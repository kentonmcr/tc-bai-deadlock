import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Welcome, {user?.email}</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Signed in and past the auth gate. The laning advisor, itemization
        advisor, and post-match reviewer land here in the next build phase.
      </p>
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
