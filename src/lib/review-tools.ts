import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { createMCPClient } from "@ai-sdk/mcp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/embeddings";

const DEADLOCK_MCP_URL = "https://api.deadlock-api.com/v1/mcp";
const MCP_CONNECT_TIMEOUT_MS = 10_000;
// Every MCP tool name gets this prefix. Tool names, descriptions, and
// schemas are fetched live from a third-party server on every request —
// prefixing makes a name collision with a first-party tool (like
// search_notes) structurally impossible, rather than depending on
// object-spread ordering staying correct forever. See CLAUDE.md.
const MCP_TOOL_PREFIX = "community_db_";

/**
 * Agentic RAG tool: semantic search over hero-kit text and this player's
 * own past reviews. The model decides for itself whether/what to search —
 * see COACH_SYSTEM_PROMPT for the "only when it would change the advice"
 * instruction. Returns an empty-with-note result rather than an error for
 * a new user with no history yet — that's expected, not a failure.
 */
export function createSearchNotesTool(supabase: SupabaseClient) {
  return tool({
    description:
      "Search hero knowledge and this player's own past match reviews for relevant context.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("A natural-language query, e.g. 'have I struggled against invisibility before'"),
    }),
    execute: async ({ query }) => {
      console.log("[search_notes] called with query:", query);
      let embedding: number[];
      try {
        embedding = await embedText(query);
      } catch {
        return { results: [], note: "Search is unavailable right now — proceed without it." };
      }

      const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: embedding,
        match_count: 5,
      });

      if (error) {
        return { results: [], note: "Search failed — proceed without this context." };
      }
      if (!data || data.length === 0) {
        return { results: [], note: "No matching notes found — likely no history in this area yet." };
      }
      return {
        results: data.map((d: { kind: string; content: string; similarity: number }) => ({
          kind: d.kind,
          content: d.content,
          similarity: d.similarity,
        })),
      };
    },
  });
}

/**
 * Races `promise` against a timer. Unlike a bare Promise.race, a promise
 * that resolves *after* we've already given up is not simply abandoned —
 * `onLateResolve` gets the value so the caller can still clean it up
 * (specifically: close an MCP client that connected too slowly to use,
 * rather than leaking it). Neither `.tools()` nor `createMCPClient` (its
 * top-level options, as opposed to per-request RequestOptions) support a
 * real AbortSignal for cancellation, so this is the available mitigation
 * for a slow-but-eventually-successful call, not a true abort.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  onLateResolve?: (value: T) => void,
): Promise<T> {
  let timedOut = false;
  if (onLateResolve) {
    promise.then((value) => {
      if (timedOut) onLateResolve(value);
    }, () => {});
  }
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        timedOut = true;
        reject(new Error(`${label} timed out after ${ms}ms`));
      }, ms),
    ),
  ]);
}

/**
 * Connects to the official, free, read-only Deadlock MCP server (hourly
 * DuckDB snapshots of the community database — see docs/ for the
 * discovery notes) and returns its tools with every name prefixed. This
 * server's tool names/descriptions/schemas are fetched live, at request
 * time, from a third-party endpoint this codebase doesn't control —
 * prefixing every name means a coincidental (or future, or malicious)
 * collision with a first-party tool name can never silently shadow it,
 * regardless of merge order. Both the connection and the tools() listing
 * are bounded by MCP_CONNECT_TIMEOUT_MS — this runs before streamText's
 * own `timeout` option even applies, and a slow/hung MCP handshake was
 * verified live to take meaningfully longer than a well-scoped query.
 *
 * On any failure (including a timeout), any client that did get created
 * is closed here rather than left for the caller to clean up — the
 * caller never receives a reference to it if this function throws.
 *
 * Caller must close the returned client in streamText's onEnd (and
 * ideally onError too), per the AI SDK's documented MCP client lifecycle
 * for streaming use.
 */
export async function createNamespacedMcpTools(): Promise<{
  client: Awaited<ReturnType<typeof createMCPClient>>;
  tools: ToolSet;
}> {
  const client = await withTimeout(
    createMCPClient({ transport: { type: "http", url: DEADLOCK_MCP_URL }, maxRetries: 1 }),
    MCP_CONNECT_TIMEOUT_MS,
    "Deadlock MCP connect",
    (lateClient) => {
      lateClient.close().catch(() => {});
    },
  );

  let rawTools;
  try {
    rawTools = await withTimeout(
      client.tools(),
      MCP_CONNECT_TIMEOUT_MS,
      "Deadlock MCP tools() listing",
    );
  } catch (err) {
    // We connected but never got usable tools back, and the caller will
    // never see `client` since this function is about to throw — close
    // it now or it's leaked for the lifetime of the process.
    await client.close().catch(() => {});
    throw err;
  }

  const tools: ToolSet = {};
  for (const [name, def] of Object.entries(rawTools)) {
    tools[`${MCP_TOOL_PREFIX}${name}`] = def;
  }

  return { client, tools };
}
