import { getHeroes } from "@/lib/deadlock-api";
import { ReviewForm } from "./review-form";

export default async function NewReviewPage() {
  const heroes = await getHeroes();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-accent">Post-Match Review</h1>
      <p className="text-sm text-muted">
        Find your account by Steam name and pick a recent match, or enter a match ID and account
        ID directly — the Coach will review your performance and can search your own past reviews
        or the community match database if it helps.
      </p>
      <ReviewForm heroes={heroes} />
    </main>
  );
}
