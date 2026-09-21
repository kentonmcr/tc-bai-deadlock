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

export function buildLaningPrompt(input: {
  myHero: string;
  partnerHero: string;
  enemyLaners: string[];
  matchupFacts: MatchupFact[];
  laneMatchup: { winRate: number | null; matches: number | null; netWorthDiff: number | null } | null;
  synergy: MatchupFact;
  topItems: Array<{ name: string; winRate: number; matches: number; avgBuyTimeRelative: number }>;
}): string {
  const lines = [
    `Laning phase. My hero: ${input.myHero}. Lane partner: ${input.partnerHero}. Enemy laner(s): ${input.enemyLaners.join(", ")}.`,
    "",
    "1v1 matchup data (win rate is from MY side's perspective):",
    formatMatchupFacts(input.matchupFacts),
    "",
    `Lane partner synergy: ${
      input.synergy.winRate !== null
        ? `${(input.synergy.winRate * 100).toFixed(1)}% win rate together (${input.synergy.matches} games)`
        : "no data"
    }`,
    "",
    input.laneMatchup
      ? `This exact duo-vs-duo lane matchup: ${
          input.laneMatchup.winRate !== null
            ? `${(input.laneMatchup.winRate * 100).toFixed(1)}% win rate (${input.laneMatchup.matches} games, avg net worth diff at sample time: ${input.laneMatchup.netWorthDiff?.toFixed(0)})`
            : "no data for this exact combination"
        }`
      : "No duo-vs-duo data available for this exact combination — reason from the 1v1 matchups and synergy above instead.",
    "",
    "Early-game item performance for my hero against this matchup (win rate, sample size, average buy timing):",
    formatItemFacts(input.topItems),
    "",
    "Give me the laning-phase buy order.",
  ];
  return lines.join("\n");
}

export function buildItemizationPrompt(input: {
  myHero: string;
  enemyTeam: string[];
  matchupFacts: MatchupFact[];
  topItems: Array<{ name: string; winRate: number; matches: number; avgBuyTimeRelative: number }>;
}): string {
  const lines = [
    `Full match. My hero: ${input.myHero}. Enemy team: ${input.enemyTeam.join(", ")}.`,
    "",
    "1v1 matchup data against each enemy hero (win rate is from MY side's perspective):",
    formatMatchupFacts(input.matchupFacts),
    "",
    "Item performance for my hero specifically against this enemy team composition (win rate, sample size, average buy timing):",
    formatItemFacts(input.topItems),
    "",
    "Give me the itemization plan for the rest of the match: what to prioritize and why, weighing the trade-offs across all six matchups above rather than just the worst one.",
  ];
  return lines.join("\n");
}
