import "server-only";
import type { Hero, Item, HeroCounterRow, ItemStatRow } from "@/lib/deadlock-api";
import { findCounterMatchup, heroName, itemName } from "@/lib/deadlock-api";

export const MAX_LANING_ENEMIES = 2;
export const MAX_ITEMIZATION_ENEMIES = 6;

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
        row.matches > 0 &&
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
