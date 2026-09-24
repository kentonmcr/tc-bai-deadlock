import { streamText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { openrouter, ADVISOR_MODEL } from "@/lib/openrouter";
import { ANALYST_SYSTEM_PROMPT, buildMatchPrompt } from "@/lib/prompts";
import {
  getHeroes,
  getItems,
  getHeroCounterStats,
  getHeroSynergyStats,
  getLaneMatchupStats,
  getItemStats,
  findSynergy,
  heroName,
} from "@/lib/deadlock-api";
import {
  MAX_LANE_ENEMIES,
  MAX_FULL_TEAM_ENEMIES,
  validateHeroId,
  validateEnemyIds,
  counterFactsForHero,
  topItemFacts,
  parseJsonBody,
  requireUser,
  checkRateLimit,
} from "@/lib/advisor";

const EARLY_GAME_BUY_TIME_THRESHOLD = 30; // avg_buy_time_relative, % of typical match
const DEADLOCK_API_DOWN_MESSAGE =
  "The Deadlock stats API is temporarily unavailable. Try again shortly.";

export async function POST(req: Request) {
  const supabase = await createClient();
  const authResult = await requireUser(supabase);
  if ("error" in authResult) return authResult.error;
  const { user } = authResult;

  const rateLimitError = await checkRateLimit(supabase, user.id, "advisor_sessions");
  if (rateLimitError) return rateLimitError;

  const body = await parseJsonBody(req);
  if (!body) {
    return new Response("Request body must be a JSON object", { status: 400 });
  }

  let heroes;
  try {
    heroes = await getHeroes();
  } catch {
    return new Response(DEADLOCK_API_DOWN_MESSAGE, { status: 502 });
  }

  const myHero = validateHeroId(heroes, body.myHero);
  const partnerHero = validateHeroId(heroes, body.partnerHero);
  const enemyTeam = validateEnemyIds(heroes, body.enemyTeam, MAX_FULL_TEAM_ENEMIES);
  // laneEnemies must be a subset of enemyTeam — the client always sends it
  // that way, but a request built by hand could claim a "lane enemy" who
  // isn't even on the enemy team, so intersect rather than trust it.
  const laneEnemiesRaw = validateEnemyIds(heroes, body.laneEnemies, MAX_LANE_ENEMIES);
  const laneEnemies = laneEnemiesRaw.filter((id) => enemyTeam.includes(id));

  if (!myHero || !partnerHero || laneEnemies.length === 0 || enemyTeam.length === 0) {
    return new Response(
      "myHero, partnerHero, at least one valid laneEnemy (max 2, must be part of enemyTeam), and at least one valid enemyTeam member (max 6) are required",
      { status: 400 },
    );
  }

  let items, counterStats, synergyStats, laneMatchupRows, laningItemStatRows, itemizationItemStatRows;
  try {
    [items, counterStats, synergyStats, laneMatchupRows, laningItemStatRows, itemizationItemStatRows] =
      await Promise.all([
        getItems(),
        getHeroCounterStats(),
        getHeroSynergyStats(),
        getLaneMatchupStats([myHero, partnerHero], laneEnemies),
        getItemStats(myHero, laneEnemies),
        getItemStats(myHero, enemyTeam),
      ]);
  } catch {
    return new Response(DEADLOCK_API_DOWN_MESSAGE, { status: 502 });
  }

  const laningMatchupFacts = laneEnemies.flatMap((enemyId) => [
    ...counterFactsForHero(heroes, counterStats, myHero, [enemyId]),
    ...counterFactsForHero(heroes, counterStats, partnerHero, [enemyId]),
  ]);
  const fullTeamMatchupFacts = counterFactsForHero(heroes, counterStats, myHero, enemyTeam);

  const synergyMatch = findSynergy(synergyStats, myHero, partnerHero);
  const synergy = {
    label: "synergy",
    winRate: synergyMatch?.winRate ?? null,
    matches: synergyMatch?.matches ?? null,
  };

  const laneMatchup = laneMatchupRows.length
    ? (() => {
        const totalMatches = laneMatchupRows.reduce((sum, r) => sum + r.matches_played, 0);
        const totalWins = laneMatchupRows.reduce((sum, r) => sum + r.wins, 0);
        // Guard against a malformed/missing net_worth_diff on any single row
        // poisoning the whole weighted average via NaN propagation.
        const netWorthSum = laneMatchupRows.reduce(
          (sum, r) => (Number.isFinite(r.net_worth_diff) ? sum + r.net_worth_diff * r.matches_played : sum),
          0,
        );
        return {
          winRate: totalMatches > 0 ? totalWins / totalMatches : null,
          matches: totalMatches,
          netWorthDiff: totalMatches > 0 && Number.isFinite(netWorthSum) ? netWorthSum / totalMatches : null,
        };
      })()
    : null;

  const laningTopItems = topItemFacts(items, laningItemStatRows, {
    maxBuyTimeRelative: EARLY_GAME_BUY_TIME_THRESHOLD,
    limit: 6,
  });
  const itemizationTopItems = topItemFacts(items, itemizationItemStatRows, { limit: 8 });

  const prompt = buildMatchPrompt({
    myHero: heroName(heroes, myHero),
    partnerHero: heroName(heroes, partnerHero),
    laneEnemies: laneEnemies.map((id) => heroName(heroes, id)),
    enemyTeam: enemyTeam.map((id) => heroName(heroes, id)),
    laningMatchupFacts,
    laneMatchup,
    synergy,
    laningTopItems,
    fullTeamMatchupFacts,
    itemizationTopItems,
  });

  const result = streamText({
    model: openrouter(ADVISOR_MODEL),
    system: ANALYST_SYSTEM_PROMPT,
    prompt,
    onError: ({ error }) => {
      console.error("Match advisor generation error:", error);
    },
    onEnd: async ({ text }) => {
      await supabase.from("advisor_sessions").insert({
        user_id: user.id,
        advisor_type: "match",
        input: { myHero, partnerHero, laneEnemies, enemyTeam },
        advice: text,
        model: ADVISOR_MODEL,
      });
    },
  });

  return result.toTextStreamResponse();
}
