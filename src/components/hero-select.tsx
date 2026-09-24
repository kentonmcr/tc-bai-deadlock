"use client";

import { useEffect, useRef, useState } from "react";
import { DlHeroCard } from "@deadlock-api/ui-react";
import type { Hero } from "@/lib/deadlock-api";

/**
 * Collapsed by default (shows the selection, or an "Add hero +" prompt) —
 * the full searchable hero grid only renders once clicked open. With up
 * to 12 of these on one page (the match advisor's lane grid), rendering
 * every grid eagerly was the single biggest source of visual clutter.
 */
export function HeroSelect({
  heroes,
  label,
  value,
  onChange,
  popoverAlign = "left",
}: {
  heroes: Hero[];
  label: string;
  value: number;
  onChange: (id: number) => void;
  /** Which edge of the trigger the popover's own edge aligns to — "left"
   * (default) works for most placements; use "right" for triggers near
   * the right edge of their container so the popover opens inward
   * instead of overflowing past the viewport edge. */
  popoverAlign?: "left" | "right";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const selectedHero = heroes.find((h) => h.id === value) ?? null;
  const filtered = query.trim()
    ? heroes.filter((h) => h.name.toLowerCase().includes(query.trim().toLowerCase()))
    : heroes;

  useEffect(() => {
    if (!isOpen) return;
    searchInputRef.current?.focus();
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  function open() {
    setQuery("");
    setActiveId(value || null);
    setIsOpen(true);
  }

  function selectHero(id: number) {
    onChange(id);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

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

  function handleGridKeyDown(e: React.KeyboardEvent) {
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
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={selectedHero ? `${label}: ${selectedHero.name}` : `${label}: add hero`}
        title={label}
        className="flex h-16 w-16 items-center justify-center overflow-hidden rounded border border-dashed border-border bg-surface/90 text-center text-[9px] leading-tight text-muted transition hover:border-accent"
      >
        {selectedHero ? (
          <DlHeroCard heroData={selectedHero} rounded borderNone style={{ "--dl-hero-card-width": "62px" } as React.CSSProperties} />
        ) : (
          <span>
            Add hero
            <br />+
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute top-full z-30 mt-2 w-72 rounded border border-accent bg-surface p-2 shadow-2xl ${
            popoverAlign === "right" ? "right-0" : "left-0"
          }`}
        >
          <p className="mb-1 px-1 text-xs font-medium text-foreground">{label}</p>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search heroes..."
            aria-label={`Search heroes for ${label}`}
            className="mb-2 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <div
            role="listbox"
            aria-label={label}
            onKeyDown={handleGridKeyDown}
            className="grid max-h-64 gap-2 overflow-y-auto rounded p-1 [grid-template-columns:repeat(auto-fill,minmax(56px,1fr))]"
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
                onClick={() => selectHero(h.id)}
                style={{ "--dl-hero-card-width": "56px" } as React.CSSProperties}
                className={`rounded transition ${
                  value === h.id ? "shadow-[0_0_0_2px_var(--accent)]" : "opacity-70 hover:opacity-100"
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
      )}
    </div>
  );
}
