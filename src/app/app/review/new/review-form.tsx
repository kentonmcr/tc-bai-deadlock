"use client";

import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { createClient } from "@/lib/supabase/client";

export function ReviewForm() {
  const [matchId, setMatchId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const { completion, complete, isLoading, error } = useCompletion({
    api: "/api/review",
    streamProtocol: "text",
    onFinish: async () => {
      const supabase = createClient();
      // The server stores match_id as String(Number(matchId)) — e.g. a
      // leading zero the user typed ("0123") gets normalized away server
      // side. Querying with the raw input string would silently miss the
      // row (the review still saves fine; only the Publish button would
      // never appear), so normalize identically here before querying.
      const normalizedMatchId = String(Number(matchId));
      const { data } = await supabase
        .from("match_reviews")
        .select("id")
        .eq("match_id", normalizedMatchId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setReviewId(data?.id ?? null);
    },
  });

  async function handlePublish() {
    if (!reviewId) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/review/${reviewId}/publish`, { method: "POST" });
      if (res.ok) {
        const { slug } = await res.json();
        setPublishedSlug(slug);
      }
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setReviewId(null);
          setPublishedSlug(null);
          complete("Review this match", {
            body: { matchId: Number(matchId), accountId: Number(accountId) },
          });
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          Match ID
          <input
            type="number"
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            required
            className="rounded border border-black/[.1] px-3 py-2 dark:border-white/[.15] dark:bg-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Your account ID
          <input
            type="number"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
            className="rounded border border-black/[.1] px-3 py-2 dark:border-white/[.15] dark:bg-transparent"
          />
        </label>
        <button
          type="submit"
          disabled={isLoading || !matchId || !accountId}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background disabled:opacity-40"
        >
          {isLoading ? "Reviewing..." : "Review this match"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>}

      {completion && (
        <pre className="whitespace-pre-wrap rounded border border-black/[.1] p-4 text-sm dark:border-white/[.15]">
          {completion}
        </pre>
      )}

      {reviewId && !publishedSlug && (
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="self-start rounded-full border border-black/[.08] px-5 py-3 text-sm font-medium dark:border-white/[.145]"
        >
          {publishing ? "Publishing..." : "Publish (get a shareable link)"}
        </button>
      )}

      {publishedSlug && (
        <p className="text-sm">
          Published:{" "}
          <a className="underline" href={`/review/${publishedSlug}`}>
            /review/{publishedSlug}
          </a>
        </p>
      )}
    </div>
  );
}
