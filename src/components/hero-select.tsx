"use client";

import { useId, useRef, useState } from "react";
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

  // Roving tabindex: only one hero button sits in the page's Tab order at a
  // time (defaults to the selected one, or the first result) — without
  // this, tabbing past this field means tabbing through all ~37 heroes
  // individually. Arrow/Home/End move both focus and this index; Tab
  // leaves the grid entirely, matching the WAI-ARIA grid/listbox pattern.
  const [activeId, setActiveId] = useState<number | null>(value || null);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const listboxId = useId();

  const activeIndex = Math.max(
    0,
    filtered.findIndex((h) => h.id === (activeId ?? value)),
  );

  function focusIndex(index: number) {
    const clamped = Math.max(0, Math.min(filtered.length - 1, index));
    const hero = filtered[clamped];
    if (!hero) return;
    setActiveId(hero.id);
    buttonRefs.current.get(hero.id)?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusIndex(activeIndex + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusIndex(activeIndex - 1);
        break;
      case "Home":
        e.preventDefault();
        focusIndex(0);
        break;
      case "End":
        e.preventDefault();
        focusIndex(filtered.length - 1);
        break;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm" id={`${listboxId}-label`}>
        {label}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search heroes..."
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>
      <div
        role="listbox"
        aria-labelledby={`${listboxId}-label`}
        onKeyDown={handleKeyDown}
        className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto rounded border border-border bg-surface p-2 sm:grid-cols-6"
      >
        {filtered.map((h, i) => (
          <button
            key={h.id}
            ref={(el) => {
              if (el) buttonRefs.current.set(h.id, el);
              else buttonRefs.current.delete(h.id);
            }}
            type="button"
            role="option"
            aria-selected={value === h.id}
            aria-label={h.name}
            tabIndex={i === activeIndex ? 0 : -1}
            onClick={() => {
              setActiveId(h.id);
              onChange(h.id);
            }}
            className={`rounded transition ${
              value === h.id
                ? "shadow-[0_0_0_2px_var(--accent)]"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            <DlHeroCard heroData={h} rounded borderNone />
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-4 text-center text-sm text-muted">No heroes match &ldquo;{query}&rdquo;.</p>
        )}
      </div>
    </div>
  );
}
