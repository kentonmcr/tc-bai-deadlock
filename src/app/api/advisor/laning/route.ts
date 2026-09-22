import { streamText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { openrouter, ADVISOR_MODEL } from "@/lib/openrouter";
import { ANALYST_SYSTEM_PROMPT, buildLaningPrompt } from "@/lib/prompts";
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
  MAX_LANING_ENEMIES,
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
  const enemyLaners = validateEnemyIds(heroes, body.enemyLaners, MAX_LANING_ENEMIES);

  if (!myHero || !partnerHero || enemyLaners.length === 0) {
    return new Response(
      "myHero, partnerHero, and at least one valid enemy laner are required (max 2 enemies)",
      { status: 400 },
    );
  }

  let items, counterStats, synergyStats, laneMatchupRows, itemStatRows;
  try {
    [items, counterStats, synergyStats, laneMatchupRows, itemStatRows] = await Promise.all([
      getItems(),
      getHeroCounterStats(),
      getHeroSynergyStats(),
      getLaneMatchupStats([myHero, partnerHero], enemyLaners),
      getItemStats(myHero, enemyLaners),
    ]);
  } catch {
    return new Response(DEADLOCK_API_DOWN_MESSAGE, { status: 502 });
  }

  const matchupFacts = enemyLaners.flatMap((enemyId) => [
    ...counterFactsForHero(heroes, counterStats, myHero, [enemyId]),
    ...counterFactsForHero(heroes, counterStats, partnerHero, [enemyId]),
  ]);

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
        // poisoning the whole weighted average via NaN propagation — this is
        // independent of totalMatches, so it can't reuse the winRate guard.
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

  const topItems = topItemFacts(items, itemStatRows, {
    maxBuyTimeRelative: EARLY_GAME_BUY_TIME_THRESHOLD,
    limit: 6,
  });

  const prompt = buildLaningPrompt({
    myHero: heroName(heroes, myHero),
    partnerHero: heroName(heroes, partnerHero),
    enemyLaners: enemyLaners.map((id) => heroName(heroes, id)),
    matchupFacts,
    laneMatchup,
    synergy,
    topItems,
  });

  const result = streamText({
    model: openrouter(ADVISOR_MODEL),
    system: ANALYST_SYSTEM_PROMPT,
    prompt,
    onError: ({ error }) => {
      console.error("Laning advisor generation error:", error);
    },
    onEnd: async ({ text }) => {
      await supabase.from("advisor_sessions").insert({
        user_id: user.id,
        advisor_type: "laning",
        input: { myHero, partnerHero, enemyLaners },
        advice: text,
        model: ADVISOR_MODEL,
      });
    },
  });

  return result.toTextStreamResponse();
}
