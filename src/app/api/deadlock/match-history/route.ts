import { createClient } from "@/lib/supabase/server";
import { requireUser, isPositiveInt } from "@/lib/advisor";
import { getMatchHistory } from "@/lib/deadlock-api";

export async function GET(req: Request) {
  const supabase = await createClient();
  const authResult = await requireUser(supabase);
  if ("error" in authResult) return authResult.error;

  const raw = new URL(req.url).searchParams.get("accountId");
  const accountId = raw ? Number(raw) : NaN;
  if (!isPositiveInt(accountId)) {
    return new Response("accountId must be a positive integer", { status: 400 });
  }

  try {
    const matches = await getMatchHistory(accountId);
    return Response.json(matches);
  } catch {
    return new Response("Match history is temporarily unavailable. Try again shortly.", { status: 502 });
  }
}
