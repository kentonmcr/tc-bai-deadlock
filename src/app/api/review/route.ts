import { streamText, stepCountIs } from "ai";
import { createClient } from "@/lib/supabase/server";
import { openrouter, ADVISOR_MODEL } from "@/lib/openrouter";
import { COACH_SYSTEM_PROMPT, buildReviewPrompt } from "@/lib/prompts";
import { getHeroes, getItems } from "@/lib/deadlock-api";
import { buildMatchSummary } from "@/lib/match-summary";
import type { ToolSet } from "ai";
import { createSearchNotesTool, createNamespacedMcpTools } from "@/lib/review-tools";
import { embedText } from "@/lib/embeddings";
import { parseJsonBody, requireUser } from "@/lib/advisor";

const DEADLOCK_API_DOWN_MESSAGE =
  "The Deadlock stats API is temporarily unavailable. Try again shortly.";

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const authResult = await requireUser(supabase);
  if ("error" in authResult) return authResult.error;
  const { user } = authResult;

  const body = await parseJsonBody(req);
  if (!body) {
    return new Response("Request body must be a JSON object", { status: 400 });
  }

  const matchId = body.matchId;
  const accountId = body.accountId;
  if (!isPositiveInt(matchId) || !isPositiveInt(accountId)) {
    return new Response("matchId and accountId must be positive integers", { status: 400 });
  }

  let heroes, items;
  try {
    [heroes, items] = await Promise.all([getHeroes(), getItems()]);
  } catch {
    return new Response(DEADLOCK_API_DOWN_MESSAGE, { status: 502 });
  }

  let summary;
  try {
    summary = await buildMatchSummary(matchId, accountId, heroes, items);
  } catch (err) {
    if (err instanceof Error && err.message === "MATCH_PLAYER_NOT_FOUND") {
      return new Response(
        "That account ID wasn't found in that match. Double-check the match ID and your account ID.",
        { status: 404 },
      );
    }
    return new Response(DEADLOCK_API_DOWN_MESSAGE, { status: 502 });
  }

  // The MCP server is a genuine agentic tool, not a required dependency —
  // if it's unreachable or slow to connect, the reviewer should still
  // work with search_notes alone rather than failing the whole request.
  let mcpClient: Awaited<ReturnType<typeof createNamespacedMcpTools>>["client"] | null = null;
  let mcpTools: ToolSet = {};
  try {
    const connected = await createNamespacedMcpTools();
    mcpClient = connected.client;
    mcpTools = connected.tools;
  } catch (err) {
    console.error("Deadlock MCP server unavailable, proceeding without it:", err);
  }

  const prompt = buildReviewPrompt(summary);

  const result = streamText({
    model: openrouter(ADVISOR_MODEL),
    system: COACH_SYSTEM_PROMPT,
    prompt,
    stopWhen: stepCountIs(4),
    // The MCP server's community-database queries can be genuinely slow
    // (a broad query can take 30s+, up to the server's own 120s ceiling) —
    // verified live. Bound both any single tool call and the whole
    // generation so a bad query can't hang the request indefinitely.
    timeout: { toolMs: 20_000, totalMs: 45_000 },
    // mcpTools spread first, first-party tools second — a first-party
    // tool must always win a name collision. In practice this is now a
    // structural non-issue too: every MCP tool name is prefixed (see
    // createNamespacedMcpTools), so a collision is no longer possible
    // even if merge order here ever changed.
    tools: {
      ...mcpTools,
      search_notes: createSearchNotesTool(supabase),
    },
    onError: ({ error }) => {
      console.error("Post-match review generation error:", error);
    },
    onToolExecutionStart: ({ toolCall }) => {
      console.log(`[review tool call] ${toolCall.toolName}:`, JSON.stringify(toolCall.input));
    },
    onEnd: async ({ text }) => {
      await mcpClient?.close();

      const { data: review, error: insertError } = await supabase
        .from("match_reviews")
        .insert({
          user_id: user.id,
          match_id: String(matchId),
          review: text,
          model: ADVISOR_MODEL,
          summary,
        })
        .select()
        .single();

      if (insertError || !review) {
        console.error("Failed to persist match review:", insertError?.message);
        return;
      }

      // Embed this review so future reviews can find it via search_notes.
      try {
        const embedding = await embedText(text);
        await supabase.from("documents").insert({
          user_id: user.id,
          source_review_id: review.id,
          kind: "match_review",
          content: text,
          embedding,
        });
      } catch (err) {
        console.error("Failed to embed match review for future search:", err);
      }
    },
  });

  return result.toTextStreamResponse();
}
