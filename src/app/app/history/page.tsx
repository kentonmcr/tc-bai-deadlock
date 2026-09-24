import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const ADVISOR_TYPE_LABEL: Record<string, string> = {
  match: "Match Plan",
  laning: "Match Plan (laning)",
  itemization: "Match Plan (itemization)",
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS already scopes every one of these to the caller, but every other
  // route in this app also filters by user.id explicitly (defense in
  // depth) — matches that convention rather than relying on RLS alone.
  const [{ data: sessions }, { data: reviews }, { data: published }] = await Promise.all([
    supabase
      .from("advisor_sessions")
      .select("id, advisor_type, advice, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("match_reviews")
      .select("id, match_id, review, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase.from("published_reviews").select("match_review_id, slug").eq("user_id", user!.id),
  ]);

  const slugByReviewId = new Map((published ?? []).map((p) => [p.match_review_id, p.slug]));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-accent">History</h1>
        <p className="text-sm text-muted">Every match plan and post-match review you&apos;ve generated.</p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Match Plans</h2>
        {!sessions || sessions.length === 0 ? (
          <p className="text-sm text-muted">No match plans yet — try the Match Advisor.</p>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded border border-border bg-surface p-4">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{ADVISOR_TYPE_LABEL[s.advisor_type] ?? s.advisor_type}</span>
                <span>{new Date(s.created_at).toLocaleString()}</span>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-foreground">{s.advice}</pre>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Post-Match Reviews</h2>
        {!reviews || reviews.length === 0 ? (
          <p className="text-sm text-muted">No reviews yet — try the Post-Match Review.</p>
        ) : (
          reviews.map((r) => {
            const slug = slugByReviewId.get(r.id);
            return (
              <div key={r.id} className="flex flex-col gap-2 rounded border border-border bg-surface p-4">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Match {r.match_id}</span>
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-foreground">{r.review}</pre>
                {slug && (
                  <Link href={`/review/${slug}`} className="self-start text-sm text-accent underline">
                    View published link
                  </Link>
                )}
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
