"use client";

import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { HeroSelect } from "@/components/hero-select";
import type { Hero } from "@/lib/deadlock-api";

type SlotKey =
  | "yellowAlly1"
  | "yellowAlly2"
  | "yellowEnemy1"
  | "yellowEnemy2"
  | "blueAlly1"
  | "blueAlly2"
  | "blueEnemy1"
  | "blueEnemy2"
  | "greenAlly1"
  | "greenAlly2"
  | "greenEnemy1"
  | "greenEnemy2";

/**
 * Percentage coordinates on the 1:1 minimap image, picked to sit beside
 * each lane's own path near where it reaches the enemy base (top) or the
 * ally base (bottom) — tuned by eye against the actual image, not derived
 * from exact pixel math.
 */
const SLOT_POSITIONS: Record<
  SlotKey,
  { top: string; left: string; label: string; popoverAlign: "left" | "right" }
> = {
  yellowEnemy1: { top: "24%", left: "10%", label: "Enemy laner 1", popoverAlign: "left" },
  yellowEnemy2: { top: "36%", left: "6%", label: "Enemy laner 2 (optional)", popoverAlign: "left" },
  yellowAlly1: { top: "62%", left: "6%", label: "Your hero", popoverAlign: "left" },
  yellowAlly2: { top: "74%", left: "10%", label: "Lane partner", popoverAlign: "left" },

  blueEnemy1: { top: "10%", left: "43%", label: "Enemy 1", popoverAlign: "left" },
  blueEnemy2: { top: "10%", left: "57%", label: "Enemy 2 (optional)", popoverAlign: "right" },
  blueAlly1: { top: "88%", left: "43%", label: "Ally 1 (optional)", popoverAlign: "left" },
  blueAlly2: { top: "88%", left: "57%", label: "Ally 2 (optional)", popoverAlign: "right" },

  greenEnemy1: { top: "24%", left: "90%", label: "Enemy 1", popoverAlign: "right" },
  greenEnemy2: { top: "36%", left: "94%", label: "Enemy 2 (optional)", popoverAlign: "right" },
  greenAlly1: { top: "62%", left: "94%", label: "Ally 1 (optional)", popoverAlign: "right" },
  greenAlly2: { top: "74%", left: "90%", label: "Ally 2 (optional)", popoverAlign: "right" },
};

function Slot({
  slotKey,
  heroes,
  values,
  setValue,
}: {
  slotKey: SlotKey;
  heroes: Hero[];
  values: Record<string, number>;
  setValue: (key: string, id: number) => void;
}) {
  const pos = SLOT_POSITIONS[slotKey];
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ top: pos.top, left: pos.left }}
    >
      <HeroSelect
        heroes={heroes}
        label={pos.label}
        value={values[slotKey] ?? 0}
        onChange={(id) => setValue(slotKey, id)}
        popoverAlign={pos.popoverAlign}
      />
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
        <div className="relative mx-auto aspect-square w-full max-w-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/minimap-ghostly.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
          <div className="pointer-events-none absolute top-[2%] left-1/2 -translate-x-1/2 text-xs font-semibold tracking-wide text-danger/70">
            ENEMY
          </div>
          <div className="pointer-events-none absolute bottom-[2%] left-1/2 -translate-x-1/2 text-xs font-semibold tracking-wide text-accent">
            YOU
          </div>
          {(Object.keys(SLOT_POSITIONS) as SlotKey[]).map((slotKey) => (
            <Slot key={slotKey} slotKey={slotKey} heroes={heroes} values={values} setValue={setValue} />
          ))}
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
