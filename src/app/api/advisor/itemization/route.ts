import { streamText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { openrouter, ADVISOR_MODEL } from "@/lib/openrouter";
import { ANALYST_SYSTEM_PROMPT, buildItemizationPrompt } from "@/lib/prompts";
import { getHeroes, getItems, getHeroCounterStats, getItemStats, heroName } from "@/lib/deadlock-api";
import {
  MAX_ITEMIZATION_ENEMIES,
  validateHeroId,
  validateEnemyIds,
  counterFactsForHero,
  topItemFacts,
  parseJsonBody,
  requireUser,
} from "@/lib/advisor";

const DEADLOCK_API_DOWN_MESSAGE =
  "The Deadlock stats API is temporarily unavailable. Try again shortly.";

export async function POST(req: Request) {
  const supabase = await createClient();
  const authResult = await requireUser(supabase);
  if ("error" in authResult) return authResult.error;
  const { user } = authResult;

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
  const enemyTeam = validateEnemyIds(heroes, body.enemyTeam, MAX_ITEMIZATION_ENEMIES);

  if (!myHero || enemyTeam.length === 0) {
    return new Response("myHero and at least one valid enemy hero are required (max 6 enemies)", {
      status: 400,
    });
  }

  let items, counterStats, itemStatRows;
  try {
    [items, counterStats, itemStatRows] = await Promise.all([
      getItems(),
      getHeroCounterStats(),
      getItemStats(myHero, enemyTeam),
    ]);
  } catch {
    return new Response(DEADLOCK_API_DOWN_MESSAGE, { status: 502 });
  }

  const matchupFacts = counterFactsForHero(heroes, counterStats, myHero, enemyTeam);
  const topItems = topItemFacts(items, itemStatRows, { limit: 8 });

  const prompt = buildItemizationPrompt({
    myHero: heroName(heroes, myHero),
    enemyTeam: enemyTeam.map((id) => heroName(heroes, id)),
    matchupFacts,
    topItems,
  });

  const result = streamText({
    model: openrouter(ADVISOR_MODEL),
    system: ANALYST_SYSTEM_PROMPT,
    prompt,
    onError: ({ error }) => {
      console.error("Itemization advisor generation error:", error);
    },
    onEnd: async ({ text }) => {
      await supabase.from("advisor_sessions").insert({
        user_id: user.id,
        advisor_type: "itemization",
        input: { myHero, enemyTeam },
        advice: text,
        model: ADVISOR_MODEL,
      });
    },
  });

  return result.toTextStreamResponse();
}
