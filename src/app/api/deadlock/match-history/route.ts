import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/advisor";
import { getMatchHistory } from "@/lib/deadlock-api";

export async function GET(req: Request) {
  const supabase = await createClient();
  const authResult = await requireUser(supabase);
  if ("error" in authResult) return authResult.error;

  const raw = new URL(req.url).searchParams.get("accountId");
  const accountId = raw ? Number(raw) : NaN;
  if (!Number.isInteger(accountId) || accountId < 0) {
    return new Response("accountId must be a non-negative integer", { status: 400 });
  }

  try {
    const matches = await getMatchHistory(accountId);
    return Response.json(matches);
  } catch {
    return new Response("Match history is temporarily unavailable. Try again shortly.", { status: 502 });
  }
}
