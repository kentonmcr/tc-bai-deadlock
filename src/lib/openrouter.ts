import "server-only";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/**
 * Server-only OpenRouter client. Reads OPENROUTER_API_KEY from
 * process.env. The "server-only" import makes an accidental
 * Client Component import a build error, not just a convention.
 */
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// See CLAUDE.md "AI rules" — this is the pinned model for both the
// Analyst and Coach personas.
export const ADVISOR_MODEL = "openai/gpt-4o-mini";
