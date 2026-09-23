import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type MatchSummaryPreview = { myHero?: string; won?: boolean; durationMinutes?: number };

export default async function PublicReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("published_review_shares")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const summary = data.match_summary as MatchSummaryPreview | null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-accent">Post-Match Review</h1>
      {summary && (
        <p className="text-sm text-muted">
          {summary.myHero} — {summary.won ? "Win" : "Loss"}, {summary.durationMinutes} minutes
        </p>
      )}
      <pre className="whitespace-pre-wrap rounded border border-border bg-surface p-4 text-sm text-foreground">
        {data.review_excerpt}
      </pre>
      <p className="text-xs text-muted">
        Published {new Date(data.published_at).toLocaleString()}
      </p>
    </main>
  );
}
