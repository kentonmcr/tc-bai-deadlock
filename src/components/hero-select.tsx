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
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-black/[.1] px-3 py-2 dark:border-white/[.15] dark:bg-transparent"
      >
        <option value="">-- pick a hero --</option>
        {heroes.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </label>
  );
}
