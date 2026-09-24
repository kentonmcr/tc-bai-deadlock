import { getHeroes } from "@/lib/deadlock-api";
import { MatchForm } from "./match-form";

export default async function MatchPage() {
  const heroes = await getHeroes();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-accent">Match Advisor</h1>
      <p className="text-sm text-muted">
        Set the full 6v6 draft, lane by lane — the Analyst gives you a laning buy order for your
        lane and a full itemization plan against the whole enemy team, in one pass.
      </p>
      <MatchForm heroes={heroes} />
    </main>
  );
}
