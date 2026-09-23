import Link from "next/link";
import { login } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <form action={login} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-center text-2xl font-semibold text-accent">Sign in</h1>
        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <input type="hidden" name="redirectTo" value={redirectTo ?? "/app"} />
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded border border-border bg-surface px-3 py-2 text-foreground focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete="current-password"
            className="rounded border border-border bg-surface px-3 py-2 text-foreground focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-accent px-5 py-3 text-sm font-medium text-background transition hover:bg-accent-strong"
        >
          Sign in
        </button>
        <p className="text-center text-sm text-muted">
          No account?{" "}
          <Link href="/signup" className="font-medium text-accent underline">
            Create one
          </Link>
        </p>
      </form>
    </main>
  );
}
