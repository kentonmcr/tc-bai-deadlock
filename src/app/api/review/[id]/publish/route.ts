import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/advisor";

type RouteParams = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = "23505";

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return new Response("Invalid review id", { status: 400 });
  }

  const supabase = await createClient();
  const authResult = await requireUser(supabase);
  if ("error" in authResult) return authResult.error;
  const { user } = authResult;

  const { data: review, error: reviewError } = await supabase
    .from("match_reviews")
    .select("id, review, summary, user_id")
    .eq("id", id)
    .single();

  if (reviewError || !review || review.user_id !== user.id) {
    return new Response("Review not found", { status: 404 });
  }

  const { data: existing } = await supabase
    .from("published_reviews")
    .select("slug")
    .eq("match_review_id", review.id)
    .maybeSingle();
  if (existing) {
    return Response.json({ slug: existing.slug });
  }

  const slug = randomBytes(9).toString("base64url");

  const { data: published, error: publishError } = await supabase
    .from("published_reviews")
    .insert({
      match_review_id: review.id,
      user_id: user.id,
      slug,
      review_excerpt: review.review,
      match_summary: review.summary,
    })
    .select("slug")
    .single();

  if (publishError) {
    // Two concurrent publish clicks can both pass the "no existing row"
    // check above before either inserts (verified live: this genuinely
    // races). The unique constraint on match_review_id prevents any bad
    // state either way, but the loser of the race should get the actual
    // slug back, not an error — it's not really a failure.
    if (publishError.code === UNIQUE_VIOLATION) {
      const { data: winner } = await supabase
        .from("published_reviews")
        .select("slug")
        .eq("match_review_id", review.id)
        .single();
      if (winner) return Response.json({ slug: winner.slug });
    }
    return new Response("Failed to publish", { status: 500 });
  }

  return Response.json({ slug: published.slug });
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return new Response("Invalid review id", { status: 400 });
  }

  const supabase = await createClient();
  const authResult = await requireUser(supabase);
  if ("error" in authResult) return authResult.error;
  const { user } = authResult;

  const { error } = await supabase
    .from("published_reviews")
    .delete()
    .eq("match_review_id", id)
    .eq("user_id", user.id);

  if (error) {
    return new Response("Failed to unpublish", { status: 500 });
  }
  return new Response(null, { status: 204 });
}
