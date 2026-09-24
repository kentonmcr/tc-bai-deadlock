"use client";

import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { HeroSelect } from "@/components/hero-select";
import type { Hero } from "@/lib/deadlock-api";

const MINIMAP_URL = "https://assets-bucket.deadlock-api.com/assets-api-res/images/maps/minimap_plain.png";

type LaneKey = "yellow" | "blue" | "green";

const LANES: Array<{ key: LaneKey; label: string; accent: string; isYours: boolean }> = [
  { key: "yellow", label: "Yellow lane", accent: "#e8c74a", isYours: true },
  { key: "blue", label: "Blue lane", accent: "#3ec6f0", isYours: false },
  { key: "green", label: "Green lane", accent: "#4fbf5c", isYours: false },
];

function LaneColumn({
  lane,
  heroes,
  values,
  setValue,
}: {
  lane: (typeof LANES)[number];
  heroes: Hero[];
  values: Record<string, number>;
  setValue: (key: string, id: number) => void;
}) {
  return (
    <div
      className="flex flex-col gap-4 rounded-lg border p-3"
      style={{ borderColor: lane.isYours ? lane.accent : `${lane.accent}4d` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: lane.accent }}>
          {lane.label}
        </span>
        {lane.isYours && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${lane.accent}26`, color: lane.accent }}>
            Yours
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted">Enemies</span>
        <HeroSelect
          heroes={heroes}
          label={lane.isYours ? "Enemy laner 1" : "Enemy 1"}
          value={values[`${lane.key}Enemy1`] ?? 0}
          onChange={(id) => setValue(`${lane.key}Enemy1`, id)}
        />
        <HeroSelect
          heroes={heroes}
          label={lane.isYours ? "Enemy laner 2 (optional)" : "Enemy 2 (optional)"}
          value={values[`${lane.key}Enemy2`] ?? 0}
          onChange={(id) => setValue(`${lane.key}Enemy2`, id)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted">{lane.isYours ? "Your team" : "Allies (optional)"}</span>
        <HeroSelect
          heroes={heroes}
          label={lane.isYours ? "Your hero" : "Ally 1 (optional)"}
          value={values[`${lane.key}Ally1`] ?? 0}
          onChange={(id) => setValue(`${lane.key}Ally1`, id)}
        />
        <HeroSelect
          heroes={heroes}
          label={lane.isYours ? "Lane partner" : "Ally 2 (optional)"}
          value={values[`${lane.key}Ally2`] ?? 0}
          onChange={(id) => setValue(`${lane.key}Ally2`, id)}
        />
      </div>
    </div>
  );
}

export function MatchForm({ heroes }: { heroes: Hero[] }) {
  const [values, setValues] = useState<Record<string, number>>({});
  const { completion, complete, isLoading, error } = useCompletion({
    api: "/api/advisor/match",
    streamProtocol: "text",
  });

  function setValue(key: string, id: number) {
    setValues((prev) => ({ ...prev, [key]: id }));
  }

  const myHero = values.yellowAlly1 ?? 0;
  const partnerHero = values.yellowAlly2 ?? 0;
  const laneEnemies = [values.yellowEnemy1, values.yellowEnemy2].filter((id): id is number => !!id);
  const enemyTeam = Array.from(
    new Set(
      [
        values.yellowEnemy1,
        values.yellowEnemy2,
        values.blueEnemy1,
        values.blueEnemy2,
        values.greenEnemy1,
        values.greenEnemy2,
      ].filter((id): id is number => !!id),
    ),
  );

  const canSubmit = !!myHero && !!partnerHero && laneEnemies.length > 0 && !isLoading;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          complete("Give me a match plan", { body: { myHero, partnerHero, laneEnemies, enemyTeam } });
        }}
        className="flex flex-col gap-4"
      >
        <div className="relative overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MINIMAP_URL}
            alt=""
            referrerPolicy="no-referrer"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-10"
          />
          <div className="relative grid grid-cols-1 gap-4 p-1 sm:grid-cols-3">
            {LANES.map((lane) => (
              <LaneColumn key={lane.key} lane={lane} heroes={heroes} values={values} setValue={setValue} />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-accent px-5 py-3 text-sm font-medium text-background transition hover:bg-accent-strong disabled:opacity-40"
        >
          {isLoading ? "Analyzing the draft..." : "Get match plan"}
        </button>
      </form>

      {error && <p className="text-sm text-danger">{error.message}</p>}

      {completion && (
        <pre className="whitespace-pre-wrap rounded border border-border bg-surface p-4 text-sm text-foreground">
          {completion}
        </pre>
      )}
    </div>
  );
}
