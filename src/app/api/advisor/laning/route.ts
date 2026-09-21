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
} from "@/lib/advisor";

const EARLY_GAME_BUY_TIME_THRESHOLD = 30; // avg_buy_time_relative, % of typical match

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const heroes = await getHeroes();

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
    return new Response("The Deadlock stats API is temporarily unavailable. Try again shortly.", {
      status: 502,
    });
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
        const avgNetWorthDiff =
          laneMatchupRows.reduce((sum, r) => sum + r.net_worth_diff * r.matches_played, 0) /
          totalMatches;
        return {
          winRate: totalMatches > 0 ? totalWins / totalMatches : null,
          matches: totalMatches,
          netWorthDiff: avgNetWorthDiff,
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
