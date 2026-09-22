import "server-only";
import type { Hero, Item } from "@/lib/deadlock-api";
import { heroName, itemName } from "@/lib/deadlock-api";

// Raw match metadata from the Deadlock API is a ~1MB+ protobuf-derived
// blob (per-player x,y,z positions, raw stat-source breakdowns, etc.).
// We only type the handful of fields actually used below — not the full
// shape — and extract a compact per-player summary before it ever
// touches a prompt.
type RawItemPurchase = { game_time_s: number; item_id: number; sold_time_s: number };
type RawDeathDetail = { game_time_s: number; killer_player_slot: number };
type RawStatSnapshot = { time_stamp_s: number; net_worth: number };
type RawPlayer = {
  account_id: number;
  player_slot: number;
  hero_id: number;
  team: number;
  kills: number;
  deaths: number;
  assists: number;
  net_worth: number;
  last_hits: number;
  denies: number;
  level: number;
  items: RawItemPurchase[];
  death_details: RawDeathDetail[];
  stats: RawStatSnapshot[];
};
type RawMatchMetadata = {
  match_info: {
    match_id: number;
    duration_s: number;
    winning_team: number;
    players: RawPlayer[];
  };
};

export type MatchSummary = {
  matchId: number;
  won: boolean;
  durationMinutes: number;
  myHero: string;
  enemyTeam: string[];
  allyTeam: string[];
  kills: number;
  deaths: number;
  assists: number;
  netWorth: number;
  lastHits: number;
  denies: number;
  level: number;
  itemTimeline: Array<{ minute: number; item: string; sold: boolean }>;
  netWorthTrend: Array<{ minute: number; netWorth: number }>;
  deathEvents: Array<{ minute: number; killedBy: string }>;
};

const MATCH_METADATA_FETCH_TIMEOUT_MS = 15_000;

async function fetchMatchMetadata(matchId: number): Promise<RawMatchMetadata> {
  // No size cap on the response — the raw payload is already ~1MB+ for a
  // typical match and could be larger for unusually long ones. A timeout
  // at least bounds a hung/slow upstream; this runs before streamText's
  // own timeout option even applies.
  const res = await fetch(`https://api.deadlock-api.com/v1/matches/${matchId}/metadata`, {
    signal: AbortSignal.timeout(MATCH_METADATA_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Deadlock API match metadata fetch failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetches a match and extracts a compact summary for one player in it.
 * Throws if the match or the given account isn't found in it — callers
 * should treat that as a 404-shaped user error, not a 502.
 */
export async function buildMatchSummary(
  matchId: number,
  accountId: number,
  heroes: Hero[],
  items: Item[],
): Promise<MatchSummary> {
  const raw = await fetchMatchMetadata(matchId);
  const info = raw.match_info;

  const me = info.players.find((p) => p.account_id === accountId);
  if (!me) {
    throw new Error("MATCH_PLAYER_NOT_FOUND");
  }

  const allies = info.players.filter((p) => p.team === me.team && p.account_id !== accountId);
  const enemies = info.players.filter((p) => p.team !== me.team);

  // These arrays are usually present, but not guaranteed for every match
  // record (e.g. a bot, a disconnected player, or an older schema
  // variant) — falling back to [] here means a genuinely missing field
  // just produces an empty section instead of an uncaught TypeError that
  // the route handler would otherwise mask as "API temporarily
  // unavailable," hiding a real, reproducible data-shape issue.
  const deathEvents = (me.death_details ?? []).map((d) => {
    const killer = info.players.find((p) => p.player_slot === d.killer_player_slot);
    return {
      minute: Math.round(d.game_time_s / 60),
      killedBy: killer ? heroName(heroes, killer.hero_id) : "unknown",
    };
  });

  return {
    matchId,
    won: me.team === info.winning_team,
    durationMinutes: Math.round(info.duration_s / 60),
    myHero: heroName(heroes, me.hero_id),
    enemyTeam: enemies.map((p) => heroName(heroes, p.hero_id)),
    allyTeam: allies.map((p) => heroName(heroes, p.hero_id)),
    kills: me.kills,
    deaths: me.deaths,
    assists: me.assists,
    netWorth: me.net_worth,
    lastHits: me.last_hits,
    denies: me.denies,
    level: me.level,
    itemTimeline: (me.items ?? []).map((i) => ({
      minute: Math.round(i.game_time_s / 60),
      item: itemName(items, i.item_id),
      sold: i.sold_time_s > 0,
    })),
    netWorthTrend: (me.stats ?? []).map((s) => ({
      minute: Math.round(s.time_stamp_s / 60),
      netWorth: s.net_worth,
    })),
    deathEvents,
  };
}
