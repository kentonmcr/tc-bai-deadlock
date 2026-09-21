"use client";

import { AdvisorForm } from "@/components/advisor-form";
import type { Hero } from "@/lib/deadlock-api";

export function LaningForm({ heroes }: { heroes: Hero[] }) {
  return (
    <AdvisorForm
      heroes={heroes}
      api="/api/advisor/laning"
      primarySlots={[
        { key: "myHero", label: "Your hero" },
        { key: "partnerHero", label: "Lane partner" },
      ]}
      enemySlots={[
        { key: "enemy1", label: "Enemy laner 1" },
        { key: "enemy2", label: "Enemy laner 2 (optional)", required: false },
      ]}
      buildBody={(v) => ({
        myHero: v.myHero,
        partnerHero: v.partnerHero,
        enemyLaners: [v.enemy1, v.enemy2].filter((id) => id > 0),
      })}
      submitLabel="Get laning advice"
      loadingLabel="Analyzing..."
    />
  );
}
