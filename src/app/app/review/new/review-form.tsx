"use client";

import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { createClient } from "@/lib/supabase/client";
import type { Hero, SteamProfile, MatchHistoryEntry } from "@/lib/deadlock-api";

function heroName(heroes: Hero[], id: number): string {
  return heroes.find((h) => h.id === id)?.name ?? `Hero #${id}`;
}

/**
 * Generic label for any tool call, whether it's the first-party
 * search_notes tool or one of the community_db_* MCP tools — both arrive
 * as untyped "dynamic-tool" parts client-side (the MCP tools' names and
 * schemas are only known at request time, fetched live from a third-party
 * server), so this exists specifically to make the agentic RAG loop
 * visible without per-tool-name UI code.
 */
function toolCallLabel(toolName: string, input: unknown): string {
  if (toolName === "search_notes") {
    const query = typeof input === "object" && input !== null && "query" in input ? String((input as { query: unknown }).query) : "";
    return query ? `Searching your notes: "${query}"` : "Searching your notes...";
  }
  if (toolName.startsWith("community_db_")) {
    return `Querying the community database (${toolName.replace("community_db_", "")})`;
  }
  return `Calling ${toolName}...`;
}

// The client deliberately doesn't share the server's tool types (some are
// only known at request time — the MCP tools' schemas are fetched live
// from a third-party server), so a narrow escape-hatch shape + type guard
// stands in for the SDK's generic ToolUIPart/DynamicToolUIPart union here.
type ToolPartLike = {
  type: string;
  toolName?: string;
  state: "input-streaming" | "input-available" | "approval-requested" | "approval-responded" | "output-available" | "output-error";
  input?: unknown;
  output?: unknown;
};

function asToolPart(part: { type: string }): ToolPartLike | null {
  if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
    return part as unknown as ToolPartLike;
  }
  return null;
}

function toolResultLabel(toolName: string, output: unknown): string {
  if (toolName === "search_notes" && typeof output === "object" && output !== null && "results" in output) {
    const results = (output as { results: unknown[] }).results;
    return results.length > 0 ? `Found ${results.length} relevant note(s)` : "No matching notes found";
  }
  if (toolName.startsWith("community_db_")) {
    return "Got a result from the community database";
  }
  return "Done";
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
  // Guards against a slower profile-A fetch resolving after a faster
  // profile-B pick and overwriting B's match list with A's — only the
  // response matching the most recent pick is ever applied to state.
  const matchHistoryRequestId = useRef(0);

  // useChat reads options (including transport) via its own internal
  // "latest options" ref on every send, so a fresh transport closing over
  // the current matchId/accountId on every render is always up to date —
  // no memoization or extra ref-juggling needed here.
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/review",
      // The server only ever reads matchId/accountId from the body — it
      // has no concept of chat history — so this replaces useChat's
      // default {messages: [...]} body entirely rather than extending it.
      prepareSendMessagesRequest: () => ({
        body: {
          matchId: Number(matchId),
          accountId: Number(accountId),
        },
      }),
    }),
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

  const isLoading = status === "submitted" || status === "streaming";
  const assistantMessage = [...messages].reverse().find((m) => m.role === "assistant");

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
    const requestId = ++matchHistoryRequestId.current;
    setSelectedProfile(profile);
    setAccountId(String(profile.account_id));
    setMatches(null);
    setMatchesError(null);
    setLoadingMatches(true);
    try {
      const res = await fetch(`/api/deadlock/match-history?accountId=${profile.account_id}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (matchHistoryRequestId.current !== requestId) return; // a newer pick superseded this one
      setMatches(data);
    } catch {
      if (matchHistoryRequestId.current !== requestId) return;
      setMatchesError("Couldn't load match history right now. Try again shortly.");
    } finally {
      if (matchHistoryRequestId.current === requestId) setLoadingMatches(false);
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
                  <img src={p.avatar} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded" />
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
          sendMessage({ text: "Review this match" });
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

      {assistantMessage && (
        <div className="flex flex-col gap-2">
          {assistantMessage.parts.map((part, i) => {
            // search_notes has a real static Zod schema, so the server
            // reconciles it into a typed "tool-search_notes" part; the
            // community_db_* MCP tools are only known at request time
            // (fetched live from a third-party server), so those arrive
            // as the generic "dynamic-tool" part instead. Both need to be
            // handled here for the tool-call trace to be complete.
            const toolPart = asToolPart(part);
            if (toolPart) {
              const toolName = toolPart.type === "dynamic-tool" ? (toolPart.toolName ?? "unknown tool") : toolPart.type.slice("tool-".length);
              return (
                <p key={i} className="text-xs italic text-zinc-500 dark:text-zinc-400">
                  {toolPart.state === "output-available"
                    ? toolResultLabel(toolName, toolPart.output)
                    : toolCallLabel(toolName, toolPart.input)}
                </p>
              );
            }
            if (part.type === "text" && part.text) {
              return (
                <pre
                  key={i}
                  className="whitespace-pre-wrap rounded border border-black/[.1] p-4 text-sm dark:border-white/[.15]"
                >
                  {part.text}
                </pre>
              );
            }
            return null;
          })}
        </div>
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
