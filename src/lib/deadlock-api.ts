import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE_URL = "https://api.deadlock-api.com";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — meta stats don't shift fast enough to need fresher data

export type Hero = {
  id: number;
  name: string;
  images?: { icon_hero_card_webp?: string; icon_hero_card?: string };
};

export type Item = {
  id: number;
  name: string;
  item_slot_type: "weapon" | "vitality" | "spirit";
  item_tier: number;
  cost: number;
  shop_image_webp?: string;
  shop_image?: string;
};

export type HeroCounterRow = {
  hero_id: number;
  enemy_hero_id: number;
  wins: number;
  matches_played: number;
};

export type HeroSynergyRow = {
  hero_id1: number;
  hero_id2: number;
  wins: number;
  matches_played: number;
};

export type LaneMatchupRow = {
  assigned_lane: number;
  hero_ids: number[];
  enemy_hero_ids: number[];
  wins: number;
  matches_played: number;
  net_worth_diff: number;
};

export type ItemStatRow = {
  item_id: number;
  wins: number;
  losses: number;
  matches: number;
  avg_buy_time_relative: number;
};

type QueryParams = Record<string, string | number | Array<string | number> | undefined>;

async function fetchJson<T>(path: string, params?: QueryParams): Promise<T> {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, String(v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Deadlock API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Read-through/write-through cache against the stats_cache table. Serves a
 * cached response if fresh, otherwise fetches live and stores the result
 * via the service-role client (clients can only read this table, never
 * write it — see the schema migration).
 */
async function cachedFetch<T>(
  endpoint: string,
  params: QueryParams,
  fetcher: () => Promise<T>,
): Promise<T> {
  const admin = createAdminClient();
  const normalizedParams = normalizeParams(params);

  // supabase-js's .eq() calls String(value) on its argument rather than
  // JSON.stringify() — for a plain object that produces the literal
  // string "[object Object]", which Postgres correctly rejects as
  // invalid JSON. Filtering a jsonb column by equality requires passing
  // the JSON text explicitly. (Row bodies for insert/upsert don't have
  // this problem — those serialize the whole object correctly.)
  const { data: cached, error: readError } = await admin
    .from("stats_cache")
    .select("response, fetched_at")
    .eq("endpoint", endpoint)
    .eq("params", JSON.stringify(normalizedParams))
    .maybeSingle();

  // A cache-read failure should never break the advisor — it just means
  // we fall through to a live fetch below. But it should never be silent
  // either: a missing grant (as happened once already) or a schema
  // mismatch should show up in logs, not disappear.
  if (readError) {
    console.error(`stats_cache read failed for ${endpoint}:`, readError.message);
  }

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
    return cached.response as T;
  }

  const fresh = await fetcher();
  const { error: writeError } = await admin.from("stats_cache").upsert(
    {
      endpoint,
      params: normalizedParams,
      response: fresh as object,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "endpoint,params" },
  );
  if (writeError) {
    console.error(`stats_cache write failed for ${endpoint}:`, writeError.message);
  }
  return fresh;
}

/** Sorts array-valued params so pick order (e.g. hero A+B vs B+A) doesn't fragment the cache. */
function normalizeParams(params: QueryParams): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    sorted[key] = Array.isArray(value) ? [...value].sort((a, b) => Number(a) - Number(b)) : value;
  }
  return sorted;
}

export async function getHeroes(): Promise<Hero[]> {
  const all = await cachedFetch<Array<Hero & { player_selectable: boolean; disabled: boolean }>>(
    "assets/heroes",
    {},
    () => fetchJson("/v1/assets/heroes"),
  );
  return all.filter((h) => h.player_selectable && !h.disabled);
}

export async function getItems(): Promise<Item[]> {
  const all = await cachedFetch<Array<Item & { shopable: boolean; disabled: boolean }>>(
    "assets/items/by-type/upgrade",
    {},
    () => fetchJson("/v1/assets/items/by-type/upgrade"),
  );
  return all.filter((i) => i.shopable && !i.disabled);
}

export async function getHeroCounterStats(): Promise<HeroCounterRow[]> {
  return cachedFetch("hero-counter-stats", {}, () =>
    fetchJson("/v1/analytics/hero-counter-stats"),
  );
}

export async function getHeroSynergyStats(): Promise<HeroSynergyRow[]> {
  return cachedFetch("hero-synergy-stats", {}, () =>
    fetchJson("/v1/analytics/hero-synergy-stats"),
  );
}

export async function getLaneMatchupStats(
  heroIds: number[],
  enemyHeroIds: number[],
): Promise<LaneMatchupRow[]> {
  const params = { hero_ids: heroIds, enemy_hero_ids: enemyHeroIds };
  return cachedFetch("lane-matchup-stats", params, () =>
    fetchJson("/v1/analytics/lane-matchup-stats", params),
  );
}

export async function getItemStats(
  heroId: number,
  enemyHeroIds: number[],
): Promise<ItemStatRow[]> {
  const params = { hero_id: heroId, enemy_hero_ids: enemyHeroIds };
  return cachedFetch("item-stats", params, () =>
    fetchJson("/v1/analytics/item-stats", params),
  );
}

export function findCounterMatchup(rows: HeroCounterRow[], heroId: number, enemyId: number) {
  const row = rows.find((r) => r.hero_id === heroId && r.enemy_hero_id === enemyId);
  if (!row || row.matches_played === 0) return null;
  return { winRate: row.wins / row.matches_played, matches: row.matches_played };
}

export function findSynergy(rows: HeroSynergyRow[], heroId: number, partnerId: number) {
  const row = rows.find(
    (r) =>
      (r.hero_id1 === heroId && r.hero_id2 === partnerId) ||
      (r.hero_id1 === partnerId && r.hero_id2 === heroId),
  );
  if (!row || row.matches_played === 0) return null;
  return { winRate: row.wins / row.matches_played, matches: row.matches_played };
}

export function heroName(heroes: Hero[], id: number): string {
  return heroes.find((h) => h.id === id)?.name ?? `Hero #${id}`;
}

export function itemName(items: Item[], id: number): string {
  return items.find((i) => i.id === id)?.name ?? `Item #${id}`;
}
