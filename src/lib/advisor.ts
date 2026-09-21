import "server-only";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import type { Hero, Item, HeroCounterRow, ItemStatRow } from "@/lib/deadlock-api";
import { findCounterMatchup, heroName, itemName } from "@/lib/deadlock-api";

export const MAX_LANING_ENEMIES = 2;
export const MAX_ITEMIZATION_ENEMIES = 6;

// Below this many games, a single-digit sample can produce a 100% (or 0%)
// win rate that would otherwise crowd out a statistically reliable item
// with a much larger sample. The Analyst persona is instructed to caveat
// thin samples, but it can only caveat what's still in the list after
// ranking and truncation — this filter runs before that, not after.
const MIN_ITEM_SAMPLE_SIZE = 10;

/** Parses a request body, rejecting anything that isn't a plain JSON object. */
export async function parseJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

/** Shared auth check for the advisor routes — returns the user or a ready-to-return 401. */
export async function requireUser(
  supabase: SupabaseClient,
): Promise<{ user: User } | { error: Response }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: new Response("Unauthorized", { status: 401 }) };
  }
  return { user };
}

/**
 * Validates a single hero ID against the real hero list. Returns null for
 * anything malformed or unknown — this is the only thing standing between
 * a client-supplied value and a string spliced directly into an LLM
 * prompt, so it must reject non-numbers and unknown IDs, not just falsy
 * values.
 */
export function validateHeroId(heroes: Hero[], id: unknown): number | null {
  if (typeof id !== "number" || !Number.isInteger(id)) return null;
  return heroes.some((h) => h.id === id) ? id : null;
}

/**
 * Validates, dedupes, and caps a list of enemy hero IDs. Every route that
 * builds a prompt from these must call this first — an unbounded or
 * malformed array here fans out into larger Deadlock API queries and a
 * larger paid OpenRouter call per request.
 */
export function validateEnemyIds(heroes: Hero[], ids: unknown, maxCount: number): number[] {
  if (!Array.isArray(ids)) return [];
  const valid = ids.filter(
    (id): id is number => typeof id === "number" && Number.isInteger(id) && heroes.some((h) => h.id === id),
  );
  return Array.from(new Set(valid)).slice(0, maxCount);
}

export type MatchupFact = { label: string; winRate: number | null; matches: number | null };

/** 1v1 counter-matchup facts for one hero against a list of enemies. */
export function counterFactsForHero(
  heroes: Hero[],
  counterStats: HeroCounterRow[],
  heroId: number,
  enemyIds: number[],
): MatchupFact[] {
  return enemyIds.map((enemyId) => ({
    label: `${heroName(heroes, heroId)} vs ${heroName(heroes, enemyId)}`,
    ...(findCounterMatchup(counterStats, heroId, enemyId) ?? { winRate: null, matches: null }),
  }));
}

export type ItemFact = { name: string; winRate: number; matches: number; avgBuyTimeRelative: number };

/** Shapes item-stats rows into ranked facts, optionally capped to an early-game buy-time window. */
export function topItemFacts(
  items: Item[],
  rows: ItemStatRow[],
  options: { maxBuyTimeRelative?: number; limit: number },
): ItemFact[] {
  return rows
    .filter(
      (row) =>
        row.matches >= MIN_ITEM_SAMPLE_SIZE &&
        (options.maxBuyTimeRelative === undefined || row.avg_buy_time_relative <= options.maxBuyTimeRelative),
    )
    .map((row) => ({
      name: itemName(items, row.item_id),
      winRate: row.wins / row.matches,
      matches: row.matches,
      avgBuyTimeRelative: row.avg_buy_time_relative,
    }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, options.limit);
}
