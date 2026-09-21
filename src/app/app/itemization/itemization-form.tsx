"use client";

import { AdvisorForm, type AdvisorFormSlot } from "@/components/advisor-form";
import type { Hero } from "@/lib/deadlock-api";

const ENEMY_SLOTS: AdvisorFormSlot[] = Array.from({ length: 6 }, (_, i) => ({
  key: `enemy${i + 1}`,
  label: `Enemy ${i + 1}${i > 0 ? " (optional)" : ""}`,
  required: i === 0,
}));

export function ItemizationForm({ heroes }: { heroes: Hero[] }) {
  return (
    <AdvisorForm
      heroes={heroes}
      api="/api/advisor/itemization"
      primarySlots={[{ key: "myHero", label: "Your hero" }]}
      enemySlots={ENEMY_SLOTS}
      enemyGrid
      buildBody={(v) => ({
        myHero: v.myHero,
        enemyTeam: ENEMY_SLOTS.map((slot) => v[slot.key]).filter((id) => id > 0),
      })}
      submitLabel="Get itemization advice"
      loadingLabel="Analyzing..."
    />
  );
}
