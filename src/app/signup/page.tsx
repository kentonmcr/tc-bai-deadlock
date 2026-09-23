import Link from "next/link";
import { signup } from "@/lib/actions/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <form action={signup} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-center text-2xl font-semibold text-accent">Create account</h1>
        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-soft">
            {message}
          </p>
        )}
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
            autoComplete="new-password"
            className="rounded border border-border bg-surface px-3 py-2 text-foreground focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-accent px-5 py-3 text-sm font-medium text-background transition hover:bg-accent-strong"
        >
          Create account
        </button>
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
