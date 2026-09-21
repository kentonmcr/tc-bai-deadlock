"use client";

import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { HeroSelect } from "@/components/hero-select";
import type { Hero } from "@/lib/deadlock-api";

export function LaningForm({ heroes }: { heroes: Hero[] }) {
  const [myHero, setMyHero] = useState(0);
  const [partnerHero, setPartnerHero] = useState(0);
  const [enemy1, setEnemy1] = useState(0);
  const [enemy2, setEnemy2] = useState(0);

  const { completion, complete, isLoading, error } = useCompletion({
    api: "/api/advisor/laning",
    streamProtocol: "text",
  });

  const enemyLaners = [enemy1, enemy2].filter((id) => id > 0);
  const canSubmit = myHero > 0 && partnerHero > 0 && enemyLaners.length > 0 && !isLoading;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          complete("Get laning advice", { body: { myHero, partnerHero, enemyLaners } });
        }}
        className="flex flex-col gap-4"
      >
        <HeroSelect heroes={heroes} label="Your hero" value={myHero} onChange={setMyHero} />
        <HeroSelect
          heroes={heroes}
          label="Lane partner"
          value={partnerHero}
          onChange={setPartnerHero}
        />
        <HeroSelect heroes={heroes} label="Enemy laner 1" value={enemy1} onChange={setEnemy1} />
        <HeroSelect
          heroes={heroes}
          label="Enemy laner 2 (optional)"
          value={enemy2}
          onChange={setEnemy2}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background disabled:opacity-40"
        >
          {isLoading ? "Analyzing..." : "Get laning advice"}
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
