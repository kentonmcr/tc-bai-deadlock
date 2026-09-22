"use client";

import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { createClient } from "@/lib/supabase/client";
import type { Hero, SteamProfile, MatchHistoryEntry } from "@/lib/deadlock-api";

function heroName(heroes: Hero[], id: number): string {
  return heroes.find((h) => h.id === id)?.name ?? `Hero #${id}`;
}

export function ReviewForm({ heroes }: { heroes: Hero[] }) {
  const [matchId, setMatchId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [steamQuery, setSteamQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<SteamProfile[] | null>(null);

  const [selectedProfile, setSelectedProfile] = useState<SteamProfile | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchHistoryEntry[] | null>(null);

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

  async function handleSteamSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    setProfiles(null);
    setSelectedProfile(null);
    setMatches(null);
    try {
      const res = await fetch(`/api/deadlock/steam-search?q=${encodeURIComponent(steamQuery)}`);
      if (!res.ok) throw new Error(await res.text());
      setProfiles(await res.json());
    } catch {
      setSearchError("Couldn't search Steam profiles right now. Try again shortly.");
    } finally {
      setSearching(false);
    }
  }

  async function handlePickProfile(profile: SteamProfile) {
    setSelectedProfile(profile);
    setAccountId(String(profile.account_id));
    setMatches(null);
    setMatchesError(null);
    setLoadingMatches(true);
    try {
      const res = await fetch(`/api/deadlock/match-history?accountId=${profile.account_id}`);
      if (!res.ok) throw new Error(await res.text());
      setMatches(await res.json());
    } catch {
      setMatchesError("Couldn't load match history right now. Try again shortly.");
    } finally {
      setLoadingMatches(false);
    }
  }

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
      <div className="flex flex-col gap-3 rounded border border-black/[.1] p-4 dark:border-white/[.15]">
        <h2 className="text-sm font-medium">Find your matches by Steam name</h2>
        <form onSubmit={handleSteamSearch} className="flex gap-2">
          <input
            type="text"
            value={steamQuery}
            onChange={(e) => setSteamQuery(e.target.value)}
            placeholder="Your Steam display name"
            className="flex-1 rounded border border-black/[.1] px-3 py-2 text-sm dark:border-white/[.15] dark:bg-transparent"
          />
          <button
            type="submit"
            disabled={searching || !steamQuery.trim()}
            className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-white/[.145]"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </form>

        {searchError && <p className="text-sm text-red-600 dark:text-red-400">{searchError}</p>}

        {profiles && profiles.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No Steam profiles matched that name.
          </p>
        )}

        {profiles && profiles.length > 0 && (
          <ul className="flex flex-col gap-1">
            {profiles.map((p) => (
              <li key={p.account_id}>
                <button
                  type="button"
                  onClick={() => handlePickProfile(p)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06] ${
                    selectedProfile?.account_id === p.account_id ? "bg-black/[.06] dark:bg-white/[.1]" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.avatar} alt="" className="h-6 w-6 rounded" />
                  <span>{p.personaname}</span>
                  <span className="text-xs text-zinc-500">
                    {p.matches_played_last_30d} matches / 30d
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {loadingMatches && <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading match history...</p>}
        {matchesError && <p className="text-sm text-red-600 dark:text-red-400">{matchesError}</p>}

        {matches && matches.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No recent matches found for this account.</p>
        )}

        {matches && matches.length > 0 && (
          <ul className="flex flex-col gap-1">
            {matches.map((m) => (
              <li key={m.match_id}>
                <button
                  type="button"
                  onClick={() => setMatchId(String(m.match_id))}
                  className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06] ${
                    matchId === String(m.match_id) ? "bg-black/[.06] dark:bg-white/[.1]" : ""
                  }`}
                >
                  <span>
                    {heroName(heroes, m.hero_id)} — {new Date(m.start_time * 1000).toLocaleDateString()}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {m.player_match_outcome === 1 ? "Win" : "Loss"} · {m.player_kills}/{m.player_deaths}/
                    {m.player_assists}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
