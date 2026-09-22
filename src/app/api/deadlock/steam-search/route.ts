import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/advisor";
import { steamSearch } from "@/lib/deadlock-api";

const MAX_QUERY_LENGTH = 64;

export async function GET(req: Request) {
  const supabase = await createClient();
  const authResult = await requireUser(supabase);
  if ("error" in authResult) return authResult.error;

  const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return new Response("q is required (max 64 characters)", { status: 400 });
  }

  try {
    const profiles = await steamSearch(query);
    return Response.json(profiles);
  } catch {
    return new Response("Steam search is temporarily unavailable. Try again shortly.", { status: 502 });
  }
}
