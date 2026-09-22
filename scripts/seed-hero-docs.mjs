// One-off seed script: embeds each playable hero's kit description into
// the `documents` table (user_id null, kind='hero_kit') so the post-match
// reviewer's search_notes tool can find hero-knowledge context.
//
// Run with: node --env-file=.env.local scripts/seed-hero-docs.mjs
// Safe to re-run — it replaces the full hero_kit set each time rather
// than accumulating duplicates.

import { createClient } from "@supabase/supabase-js";
import { embed } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const res = await fetch("https://api.deadlock-api.com/v1/assets/heroes");
if (!res.ok) throw new Error(`Deadlock API heroes fetch failed: ${res.status}`);
const allHeroes = await res.json();
const heroes = allHeroes.filter((h) => h.player_selectable && !h.disabled);

console.log(`Seeding ${heroes.length} hero-kit documents...`);

const { error: deleteError } = await admin
  .from("documents")
  .delete()
  .is("user_id", null)
  .eq("kind", "hero_kit");
if (deleteError) throw new Error(`Failed to clear old hero_kit docs: ${deleteError.message}`);

for (const hero of heroes) {
  const description = hero.description ?? {};
  const content = [
    `Hero: ${hero.name}`,
    hero.hero_type ? `Type: ${hero.hero_type}` : null,
    hero.tags?.length ? `Tags: ${hero.tags.join(", ")}` : null,
    description.role ? `Role: ${description.role}` : null,
    description.playstyle ? `Playstyle: ${description.playstyle}` : null,
    description.lore ? `Lore: ${description.lore}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { embedding } = await embed({
    model: openrouter.textEmbeddingModel("openai/text-embedding-3-small"),
    value: content,
  });

  const { error: insertError } = await admin.from("documents").insert({
    user_id: null,
    kind: "hero_kit",
    content,
    embedding,
  });
  if (insertError) throw new Error(`Failed to insert doc for ${hero.name}: ${insertError.message}`);
  console.log(`  seeded: ${hero.name}`);
}

console.log("Done.");
