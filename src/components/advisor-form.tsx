"use client";

import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { HeroSelect } from "@/components/hero-select";
import type { Hero } from "@/lib/deadlock-api";

export type AdvisorFormSlot = {
  key: string;
  label: string;
  required?: boolean;
};

/**
 * Shared picker-form shell for both advisor pages. Laning and
 * itemization differ only in which slots they show, how the enemy
 * slots are laid out, and how the selected values map to a request
 * body — everything else (state, streaming, submit gating, error and
 * completion display) is identical, so it lives here once.
 */
export function AdvisorForm({
  heroes,
  api,
  primarySlots,
  enemySlots,
  enemyGrid = false,
  buildBody,
  submitLabel,
  loadingLabel,
}: {
  heroes: Hero[];
  api: string;
  primarySlots: AdvisorFormSlot[];
  enemySlots: AdvisorFormSlot[];
  enemyGrid?: boolean;
  buildBody: (values: Record<string, number>) => Record<string, unknown>;
  submitLabel: string;
  loadingLabel: string;
}) {
  const [values, setValues] = useState<Record<string, number>>({});
  const { completion, complete, isLoading, error } = useCompletion({ api, streamProtocol: "text" });

  const allSlots = [...primarySlots, ...enemySlots];
  const canSubmit =
    allSlots.filter((s) => s.required !== false).every((s) => (values[s.key] ?? 0) > 0) && !isLoading;

  function setValue(key: string, id: number) {
    setValues((prev) => ({ ...prev, [key]: id }));
  }

  const enemySelects = enemySlots.map((slot) => (
    <HeroSelect
      key={slot.key}
      heroes={heroes}
      label={slot.label}
      value={values[slot.key] ?? 0}
      onChange={(id) => setValue(slot.key, id)}
    />
  ));

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          complete(submitLabel, { body: buildBody(values) });
        }}
        className="flex flex-col gap-4"
      >
        {primarySlots.map((slot) => (
          <HeroSelect
            key={slot.key}
            heroes={heroes}
            label={slot.label}
            value={values[slot.key] ?? 0}
            onChange={(id) => setValue(slot.key, id)}
          />
        ))}
        {enemyGrid ? <div className="grid grid-cols-2 gap-4">{enemySelects}</div> : enemySelects}
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background disabled:opacity-40"
        >
          {isLoading ? loadingLabel : submitLabel}
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
