import type { Metadata } from "next";
import { Suspense } from "react";
import { MatchesBoard } from "@/components/matches-board";
import { NextDrop } from "@/components/next-drop";
import { requireUser } from "@/lib/auth";
import { partnerId, partnerResponse, viewerResponse } from "@/lib/match-view";
import type { MatchCardModel, MatchResponse, MatchStatus, MatchType } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Matches",
};

const MATCH_COLUMNS =
  "id, user_id, matched_user_id, week_start, match_type, score, why_matched, status, user_response, matched_response";

type MatchRow = {
  id: string;
  user_id: string;
  matched_user_id: string;
  week_start: string;
  match_type: MatchType;
  score: number;
  why_matched: string;
  status: MatchStatus;
  user_response: MatchResponse;
  matched_response: MatchResponse;
};

type PartnerRow = {
  id: string;
  college: string;
  class_year: number;
};

export default function MatchesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Loading matches…</p>}>
        <MatchesContent />
      </Suspense>
    </main>
  );
}

async function MatchesContent() {
  const profile = await requireUser();
  const supabase = await createClient();

  const [asUser, asMatch, questionnaire] = await Promise.all([
    supabase.from("matches").select(MATCH_COLUMNS).eq("user_id", profile.id),
    supabase.from("matches").select(MATCH_COLUMNS).eq("matched_user_id", profile.id),
    supabase.from("questionnaires").select("user_id").eq("user_id", profile.id).maybeSingle(),
  ]);

  const error = asUser.error ?? asMatch.error ?? questionnaire.error;
  if (error) {
    return <p className="text-sm text-clay">Could not load matches. {error.message}</p>;
  }

  const rows = [...((asUser.data ?? []) as MatchRow[]), ...((asMatch.data ?? []) as MatchRow[])];
  const unique = new Map(rows.map((row) => [row.id, row]));
  const matches = Array.from(unique.values()).sort((a, b) => b.week_start.localeCompare(a.week_start));

  const partnerIds = Array.from(new Set(matches.map((match) => partnerId(match, profile.id))));
  const partners = new Map<string, PartnerRow>();
  if (partnerIds.length > 0) {
    const { data } = await supabase
      .from("users")
      .select("id, college, class_year")
      .in("id", partnerIds);
    for (const partner of (data ?? []) as PartnerRow[]) partners.set(partner.id, partner);
  }

  const cards: MatchCardModel[] = matches.map((match) => {
    const otherId = partnerId(match, profile.id);
    const partner = partners.get(otherId);
    return {
      id: match.id,
      matchType: match.match_type,
      weekStart: String(match.week_start).slice(0, 10),
      score: Number(match.score),
      whyMatched: match.why_matched,
      status: match.status,
      viewerResponse: viewerResponse(match, profile.id),
      partnerResponse: partnerResponse(match, profile.id),
      partner: {
        id: otherId,
        college: partner?.college ?? "Yale",
        classYear: partner?.class_year ?? 0,
      },
    };
  });

  return (
    <>
      <NextDrop prominent />
      <div className="mt-8">
        <MatchesBoard hasQuestionnaire={Boolean(questionnaire.data)} matches={cards} />
      </div>
    </>
  );
}
