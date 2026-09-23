import { getHeroes } from "@/lib/deadlock-api";
import { ItemizationForm } from "./itemization-form";

export default async function ItemizationPage() {
  const heroes = await getHeroes();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-accent">Itemization Advisor</h1>
      <p className="text-sm text-muted">
        Pick your hero and as many of the enemy team as you know — the Analyst will weigh the
        trade-offs across all of them, not just your worst matchup.
      </p>
      <ItemizationForm heroes={heroes} />
    </main>
  );
}
