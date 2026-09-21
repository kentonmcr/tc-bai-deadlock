"use client";

import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { HeroSelect } from "@/components/hero-select";
import type { Hero } from "@/lib/deadlock-api";

const ENEMY_SLOTS = 6;

export function ItemizationForm({ heroes }: { heroes: Hero[] }) {
  const [myHero, setMyHero] = useState(0);
  const [enemyTeam, setEnemyTeam] = useState<number[]>(Array(ENEMY_SLOTS).fill(0));

  const { completion, complete, isLoading, error } = useCompletion({
    api: "/api/advisor/itemization",
    streamProtocol: "text",
  });

  const pickedEnemies = enemyTeam.filter((id) => id > 0);
  const canSubmit = myHero > 0 && pickedEnemies.length > 0 && !isLoading;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          complete("Get itemization advice", { body: { myHero, enemyTeam: pickedEnemies } });
        }}
        className="flex flex-col gap-4"
      >
        <HeroSelect heroes={heroes} label="Your hero" value={myHero} onChange={setMyHero} />
        <div className="grid grid-cols-2 gap-4">
          {enemyTeam.map((value, i) => (
            <HeroSelect
              key={i}
              heroes={heroes}
              label={`Enemy ${i + 1}${i > 0 ? " (optional)" : ""}`}
              value={value}
              onChange={(id) => setEnemyTeam((prev) => prev.map((v, idx) => (idx === i ? id : v)))}
            />
          ))}
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background disabled:opacity-40"
        >
          {isLoading ? "Analyzing..." : "Get itemization advice"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>}

      {completion && (
        <pre className="whitespace-pre-wrap rounded border border-black/[.1] p-4 text-sm dark:border-white/[.15]">
          {completion}
        </pre>
      )}
    </div>
  );
}
