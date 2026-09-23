"use client";

import { useState } from "react";
import { DlHeroCard } from "@deadlock-api/ui-react";
import type { Hero } from "@/lib/deadlock-api";

export function HeroSelect({
  heroes,
  label,
  value,
  onChange,
}: {
  heroes: Hero[];
  label: string;
  value: number;
  onChange: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? heroes.filter((h) => h.name.toLowerCase().includes(query.trim().toLowerCase()))
    : heroes;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        {label}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search heroes..."
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>
      <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto rounded border border-border bg-surface p-2 sm:grid-cols-6">
        {filtered.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => onChange(h.id)}
            aria-label={h.name}
            aria-pressed={value === h.id}
            className={`rounded transition ${
              value === h.id
                ? "shadow-[0_0_0_2px_var(--accent)]"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            <DlHeroCard heroId={h.id} rounded borderNone />
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-4 text-center text-sm text-muted">No heroes match &ldquo;{query}&rdquo;.</p>
        )}
      </div>
    </div>
  );
}
