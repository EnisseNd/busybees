import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { Scrap } from "@/components/scrap";
import { Tray } from "@/components/tray";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/constants";
import { partnerId } from "@/lib/match-view";
import { cardClass } from "@/lib/styles";
import { parsePlan, parseTray, partnerName, planLine, trayIsEmpty } from "@/lib/tray";
import type { ChatMessage, MatchStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Chat",
};

export default function ChatPage({ params }: { params: Promise<{ matchId: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Opening the chat…</p>}>
        <ChatLoader params={params} />
      </Suspense>
    </main>
  );
}

async function ChatLoader({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  if (!isUuid(matchId)) notFound();

  const profile = await requireUser();
  const supabase = await createClient();

  // `plan`, `first_name` and `tray` come with the trays-and-calendar
  // migration. If a column is missing, ask again for the original ones.
  const baseMatchColumns = "id, user_id, matched_user_id, status, why_matched, match_type";
  let matchResult = await supabase
    .from("matches")
    .select(`${baseMatchColumns}, plan`)
    .eq("id", matchId)
    .maybeSingle();
  if (matchResult.error) {
    matchResult = await supabase
      .from("matches")
      .select(baseMatchColumns)
      .eq("id", matchId)
      .maybeSingle();
  }

  const row = matchResult.data as unknown as {
    id: string;
    user_id: string;
    matched_user_id: string;
    status: MatchStatus;
    why_matched: string;
    match_type: "friend" | "study";
    plan?: unknown;
  } | null;

  if (!row || (row.user_id !== profile.id && row.matched_user_id !== profile.id)) {
    notFound();
  }

  const otherId = partnerId(row, profile.id);
  let partnerResult = await supabase
    .from("users")
    .select("college, class_year, first_name, tray")
    .eq("id", otherId)
    .maybeSingle();
  if (partnerResult.error) {
    partnerResult = await supabase
      .from("users")
      .select("college, class_year")
      .eq("id", otherId)
      .maybeSingle();
  }

  const person = partnerResult.data as unknown as {
    college: string;
    class_year: number;
    first_name?: string | null;
    tray?: unknown;
  } | null;

  const firstName = person?.first_name?.trim() ?? "";
  const college = person?.college ?? "";
  const tray = parseTray(person?.tray);
  const plan = parsePlan(row.plan);
  const mutual = row.status === "mutual";
  const messages = mutual ? await loadMessages(matchId) : [];
  const details = [
    row.match_type === "study" ? "Study buddy" : "Friend match",
    firstName && college ? college : "",
    person?.class_year ? `class of ${person.class_year}` : "",
  ].filter(Boolean);

  return (
    <>
      <Link className="text-sm font-extrabold text-leaf underline underline-offset-2" href="/matches">
        Back to matches
      </Link>

      <header className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
        {trayIsEmpty(tray) ? null : (
          <div className="chat-tray">
            <Tray items={tray} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-4xl leading-tight text-ink">
            {partnerName(firstName, college)}
          </h1>
          <p className="mt-1 text-sm font-bold text-muted">{details.join(", ")}</p>
          <p className="mt-3">
            <Scrap className="deck-note" shape={1} tilt={-1}>
              {row.why_matched}
            </Scrap>
          </p>
          {plan ? (
            <p className="mt-2">
              <Scrap className="deck-note deck-note-plan" tilt={1} white>
                {planLine(plan)}
              </Scrap>
            </p>
          ) : null}
        </div>
      </header>

      {mutual ? (
        <ChatPanel currentUserId={profile.id} initialMessages={messages} matchId={matchId} />
      ) : (
        <div className={`${cardClass} mt-6`}>
          <h2 className="text-xl font-black text-ink">Chat isn&rsquo;t open yet</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            It opens once you&rsquo;ve both said interested.
          </p>
        </div>
      )}
    </>
  );
}

async function loadMessages(matchId: string): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, sender_id, content, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as Array<{
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
  }>;

  return rows
    .map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      content: row.content,
      createdAt: row.created_at,
    }))
    .reverse();
}
