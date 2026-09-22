import { ReviewForm } from "./review-form";

export default function NewReviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Post-Match Review</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Enter a match ID and your account ID — the Coach will review your performance and can
        search your own past reviews or the community match database if it helps.
      </p>
      <ReviewForm />
    </main>
  );
}
