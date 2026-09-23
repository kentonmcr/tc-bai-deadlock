import { getHeroes } from "@/lib/deadlock-api";
import { LaningForm } from "./laning-form";

export default async function LaningPage() {
  const heroes = await getHeroes();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-accent">Laning Advisor</h1>
      <p className="text-sm text-muted">
        Pick your hero, your lane partner, and the enemy laner(s) — the Analyst will give you a
        buy order grounded in live matchup data.
      </p>
      <LaningForm heroes={heroes} />
    </main>
  );
}
