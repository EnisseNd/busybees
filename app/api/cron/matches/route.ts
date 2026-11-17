import { NextResponse } from "next/server";
import { generateWeeklyMatches } from "@/lib/matching";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Weekly entry point. Call with Authorization: Bearer $CRON_SECRET.
 * GET is included because some schedulers (including Vercel Cron) use GET.
 * The secret stays off the query string.
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const result = await generateWeeklyMatches(supabase);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Match generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}
