/**
 * The Analyst persona — used for both the laning and itemization
 * advisors. Deliberately distinct from a generic assistant: terse,
 * numbers-first, commits to one buy order instead of hedging. Tuned
 * as its own focused pass (the "Tuned persona" optional task), not a
 * first draft left as-is.
 */
export const ANALYST_SYSTEM_PROMPT = `You are the Analyst, an in-game itemization advisor for Deadlock. You are not a chatbot and you do not make small talk. Someone is about to walk into a match and needs a decision, not a discussion.

Rules:
- Open with the buy order. Not a summary, not a disclaimer — the buy order, as a numbered list, first thing.
- Every item in the buy order needs a one-line reason tied to an actual number you were given (a win rate, a matchup sample size, a synergy figure). Never justify an item with vague language like "this is generally strong" — if you don't have a number backing an item, say so explicitly instead of inventing confidence.
- When the matchup data is thin (small sample size), say so in one clause and still commit to a recommendation — e.g. "small sample (140 games), but it leans your way" — never refuse to answer or drown the buy order in hedging.
- Never say "it depends" as a complete answer. If it depends on something, name the something and pick the default assumption you're using.
- Close with at most two sentences on what to reassess mid-match and why. Nothing after that — no summary, no "good luck," no sign-off.
- Plain text only. No markdown headers, no emoji.`;

type MatchupFact = {
  label: string;
  winRate: number | null;
  matches: number | null;
};

function formatMatchupFacts(facts: MatchupFact[]): string {
  return facts
    .map((f) => {
      if (f.winRate === null) return `${f.label}: no data`;
      return `${f.label}: ${(f.winRate * 100).toFixed(1)}% win rate (${f.matches} games)`;
    })
    .join("\n");
}

function formatItemFacts(
  items: Array<{ name: string; winRate: number; matches: number; avgBuyTimeRelative: number }>,
): string {
  return items
    .map(
      (i) =>
        `${i.name}: ${(i.winRate * 100).toFixed(1)}% win rate (${i.matches} games), bought at ~${i.avgBuyTimeRelative.toFixed(0)}% match progress on average`,
    )
    .join("\n");
}

/**
 * Combines the laning and itemization asks into one prompt, since the
 * match advisor collects a full 6v6 draft at once (real lane-select
 * screens show everyone simultaneously — there's no staggered reveal to
 * respect) rather than the earlier two-separate-flows split. Two clearly
 * labeled sections rather than two separate LLM calls stitched together
 * client-side, so the model can't drift persona/tone between them.
 */
export function buildMatchPrompt(input: {
  myHero: string;
  partnerHero: string;
  laneEnemies: string[];
  enemyTeam: string[];
  laningMatchupFacts: MatchupFact[];
  laneMatchup: { winRate: number | null; matches: number | null; netWorthDiff: number | null } | null;
  synergy: MatchupFact;
  laningTopItems: Array<{ name: string; winRate: number; matches: number; avgBuyTimeRelative: number }>;
  fullTeamMatchupFacts: MatchupFact[];
  itemizationTopItems: Array<{ name: string; winRate: number; matches: number; avgBuyTimeRelative: number }>;
}): string {
  const lines = [
    `My hero: ${input.myHero}. Lane partner: ${input.partnerHero}. My lane's enemies: ${input.laneEnemies.join(", ")}. Full enemy team: ${input.enemyTeam.join(", ")}.`,
    "",
    "=== EARLY GAME — my lane ===",
    "1v1 matchup data against my lane's enemies (win rate is from MY side's perspective):",
    formatMatchupFacts(input.laningMatchupFacts),
    "",
    `Lane partner synergy: ${
      input.synergy.winRate !== null
        ? `${(input.synergy.winRate * 100).toFixed(1)}% win rate together (${input.synergy.matches} games)`
        : "no data"
    }`,
    "",
    input.laneMatchup && input.laneMatchup.winRate !== null
      ? `This exact duo-vs-duo lane matchup: ${(input.laneMatchup.winRate * 100).toFixed(1)}% win rate (${input.laneMatchup.matches} games${
          input.laneMatchup.netWorthDiff !== null
            ? `, avg net worth diff at sample time: ${input.laneMatchup.netWorthDiff.toFixed(0)}`
            : ""
        })`
      : "No duo-vs-duo data available for this exact combination — reason from the 1v1 matchups and synergy above instead.",
    "",
    "Early-game item performance for my hero against my lane's enemies (win rate, sample size, average buy timing):",
    formatItemFacts(input.laningTopItems),
    "",
    "=== LATE GAME — full match, full enemy team ===",
    "1v1 matchup data against every enemy hero (win rate is from MY side's perspective):",
    formatMatchupFacts(input.fullTeamMatchupFacts),
    "",
    "Item performance for my hero against this full enemy team composition (win rate, sample size, average buy timing):",
    formatItemFacts(input.itemizationTopItems),
    "",
    "Give me two clearly labeled sections: (1) the laning-phase buy order for my specific lane, (2) the itemization plan for the rest of the match weighing the trade-offs across all six enemy matchups, not just my lane opponents.",
  ];
  return lines.join("\n");
}

/**
 * Groups deaths by killer with pre-computed counts. Given directly to
 * the model rather than a flat chronological list — verified live that
 * gpt-4o-mini miscounts occurrences when asked to tally a list itself
 * (reported "four deaths" for a hero killed 5 times, in the same
 * response that separately gave the correct minute for each of the
 * individual deaths it did cite). Pre-aggregating removes the arithmetic
 * from the model's job entirely.
 */
function formatDeathEvents(events: Array<{ minute: number; killedBy: string }>): string {
  if (events.length === 0) return "No deaths this match.";
  const byKiller = new Map<string, number[]>();
  for (const { minute, killedBy } of events) {
    byKiller.set(killedBy, [...(byKiller.get(killedBy) ?? []), minute]);
  }
  return Array.from(byKiller.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([killer, minutes]) => `${killer}: ${minutes.length} death(s), at ${minutes.join("m, ")}m`)
    .join("\n");
}

/**
 * The Coach persona — post-match reviewer. Deliberately different voice
 * from the Analyst: reflective and teaching rather than terse and
 * decisive, because the job is different (explain what happened, not
 * decide what to buy right now). Also the only persona with tools —
 * search_notes (personal history + hero kit) and the official Deadlock
 * MCP server's SQL tools over community data — and is explicitly told
 * to use them only when they'd change the advice, not reflexively.
 */
export const COACH_SYSTEM_PROMPT = `You are the Coach, a post-match reviewer for Deadlock. You talk through a match the way a coach reviews game tape with a player — specific, grounded in what actually happened, never generic.

Rules:
- Open with the one-sentence verdict: what actually decided this game (a fight, a itemization gap, a lane loss that snowballed) — not "you won" or "you lost."
- Every point you make must tie to a specific number or event you were given (a death, an item timing, a net worth swing) — never a generic "good job" or "watch your positioning" with nothing behind it.
- You have two kinds of tools: search_notes (your own hero-knowledge base and this player's past reviews — private to this player) and community_db_* tools (execute_query and schema-exploration tools over the Deadlock community's match database — an external, third-party service). Use them only when they would genuinely change what you tell the player. Do not call a tool just to look thorough, and do not call a tool for something the match data already answers.
- Never include any text returned by search_notes inside a community_db_* call (not in the SQL, not in any argument) — search_notes can surface this player's private review content, and community_db_* sends its input to an external server. Keep those two data paths completely separate.
- If you do use the community_db_* tools, explore the schema (list tables/columns) before writing a query if you don't already know the shape, and always scope queries narrowly (a specific match_id, hero_id, or a LIMIT) — broad unfiltered aggregations over the full match history are slow enough to time out.
- Close with exactly one concrete thing to focus on next game, tied to the specific pattern you found. Not a list, one thing.
- Plain text only. No markdown headers, no emoji.`;

export function buildReviewPrompt(input: {
  myHero: string;
  won: boolean;
  durationMinutes: number;
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
}): string {
  const lines = [
    `Match result: ${input.won ? "WIN" : "LOSS"}, ${input.durationMinutes} minutes.`,
    `My hero: ${input.myHero}. Allies: ${input.allyTeam.join(", ")}. Enemies: ${input.enemyTeam.join(", ")}.`,
    `Final stats: ${input.kills}/${input.deaths}/${input.assists} KDA, ${input.netWorth} net worth, ${input.lastHits} last hits, ${input.denies} denies, level ${input.level}.`,
    "",
    "Deaths, pre-counted per hero — use these counts exactly, do not recount or re-tally them yourself. \"Holliday: 2 deaths\" means YOU died to Holliday twice, not that Holliday died:",
    formatDeathEvents(input.deathEvents),
    "",
    "Net worth over time (minute: net worth):",
    input.netWorthTrend.map((s) => `${s.minute}m: ${s.netWorth}`).join(", "),
    "",
    "Item purchase timeline (minute bought, item, sold?):",
    input.itemTimeline.map((i) => `${i.minute}m: ${i.item}${i.sold ? " (sold)" : ""}`).join("\n"),
    "",
    "Review this match.",
  ];
  return lines.join("\n");
}
