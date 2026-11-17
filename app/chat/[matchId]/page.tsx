import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/constants";
import { partnerId } from "@/lib/match-view";
import { cardClass } from "@/lib/styles";
import type { ChatMessage, MatchStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Chat",
};

export default function ChatPage({ params }: { params: Promise<{ matchId: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Opening chat…</p>}>
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
  const { data: match } = await supabase
    .from("matches")
    .select("id, user_id, matched_user_id, status, why_matched, match_type")
    .eq("id", matchId)
    .maybeSingle();

  const row = match as {
    id: string;
    user_id: string;
    matched_user_id: string;
    status: MatchStatus;
    why_matched: string;
    match_type: "friend" | "study";
  } | null;

  if (!row || (row.user_id !== profile.id && row.matched_user_id !== profile.id)) {
    notFound();
  }

  const otherId = partnerId(row, profile.id);
  const { data: partner } = await supabase
    .from("users")
    .select("college, class_year")
    .eq("id", otherId)
    .maybeSingle();

  const person = partner as { college: string; class_year: number } | null;
  const mutual = row.status === "mutual";
  const messages = mutual ? await loadMessages(matchId) : [];

  return (
    <>
      <Link className="text-sm font-medium text-yale" href="/matches">
        Back to matches
      </Link>
      <h1 className="mt-3 font-serif text-4xl text-ink">
        {person?.college ?? "Yale"}
        {person?.class_year ? (
          <span className="ml-2 font-sans text-base text-muted">Class of {person.class_year}</span>
        ) : null}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {row.match_type === "study" ? "Study buddy" : "Friend"} · {row.why_matched}
      </p>

      {mutual ? (
        <ChatPanel currentUserId={profile.id} initialMessages={messages} matchId={matchId} />
      ) : (
        <div className={`${cardClass} mt-6`}>
          <h2 className="font-serif text-2xl">Chat is still closed</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Chat stays on SocialSync, and it opens after both of you tap Interested.
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
