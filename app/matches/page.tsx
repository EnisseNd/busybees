import type { Metadata } from "next";
import { Suspense } from "react";
import { MatchesBoard } from "@/components/matches-board";
import { NextDrop } from "@/components/next-drop";
import { requireUser } from "@/lib/auth";
import { partnerId, partnerResponse, viewerResponse } from "@/lib/match-view";
import { parsePlan, parseTray, trayIsEmpty } from "@/lib/tray";
import type { MatchCardModel, MatchResponse, MatchStatus, MatchType } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Matches",
};

const BASE_MATCH_COLUMNS =
  "id, user_id, matched_user_id, week_start, match_type, score, why_matched, status, user_response, matched_response";
// `plan` arrives with the trays-and-calendar migration. If the column is
// missing we ask again without it.
const MATCH_COLUMNS = `${BASE_MATCH_COLUMNS}, plan`;

const BASE_PARTNER_COLUMNS = "id, college, class_year";
const PARTNER_COLUMNS = `${BASE_PARTNER_COLUMNS}, first_name, tray`;

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
  plan?: unknown;
};

type PartnerRow = {
  id: string;
  college: string;
  class_year: number;
  first_name?: string | null;
  tray?: unknown;
};

export default function MatchesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Getting your matches…</p>}>
        <MatchesContent />
      </Suspense>
    </main>
  );
}

async function MatchesContent() {
  const profile = await requireUser();
  const supabase = await createClient();

  async function loadMatches(columns: string) {
    const [asUser, asMatch] = await Promise.all([
      supabase.from("matches").select(columns).eq("user_id", profile.id),
      supabase.from("matches").select(columns).eq("matched_user_id", profile.id),
    ]);
    return {
      error: asUser.error ?? asMatch.error,
      rows: [
        ...((asUser.data ?? []) as unknown as MatchRow[]),
        ...((asMatch.data ?? []) as unknown as MatchRow[]),
      ],
    };
  }

  const [firstTry, questionnaire, own] = await Promise.all([
    loadMatches(MATCH_COLUMNS),
    supabase.from("questionnaires").select("user_id").eq("user_id", profile.id).maybeSingle(),
    supabase.from("users").select("tray").eq("id", profile.id).maybeSingle(),
  ]);

  const loaded = firstTry.error ? await loadMatches(BASE_MATCH_COLUMNS) : firstTry;
  const error = loaded.error ?? questionnaire.error;
  if (error) {
    return (
      <p className="border-2 border-alert bg-white px-4 py-3 text-sm font-bold text-alert">
        Your matches didn&rsquo;t load. {error.message}
      </p>
    );
  }

  const unique = new Map(loaded.rows.map((row) => [row.id, row]));
  const matches = Array.from(unique.values()).sort((a, b) =>
    String(b.week_start).localeCompare(String(a.week_start)),
  );

  const partnerIds = Array.from(new Set(matches.map((match) => partnerId(match, profile.id))));
  const partners = new Map<string, PartnerRow>();
  if (partnerIds.length > 0) {
    const full = await supabase.from("users").select(PARTNER_COLUMNS).in("id", partnerIds);
    const rows = full.error
      ? (await supabase.from("users").select(BASE_PARTNER_COLUMNS).in("id", partnerIds)).data
      : full.data;
    for (const partner of (rows ?? []) as unknown as PartnerRow[]) {
      partners.set(partner.id, partner);
    }
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
      plan: parsePlan(match.plan),
      partner: {
        id: otherId,
        firstName: partner?.first_name?.trim() ?? "",
        college: partner?.college ?? "",
        classYear: partner?.class_year ?? 0,
        tray: parseTray(partner?.tray),
      },
    };
  });

  // Only nudge about the tray when we could actually read it. An error means
  // the migration has not run, and the editor could not save anyway.
  const ownTray = own.error ? null : (own.data as { tray: unknown } | null);
  const needsTray = ownTray !== null && trayIsEmpty(parseTray(ownTray.tray));

  return (
    <>
      <NextDrop prominent />
      <div className="mt-8">
        <MatchesBoard
          hasQuestionnaire={Boolean(questionnaire.data)}
          matches={cards}
          needsTray={needsTray}
        />
      </div>
    </>
  );
}
