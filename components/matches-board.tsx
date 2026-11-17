"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToMatch } from "@/app/actions/matches";
import { formatWeek } from "@/lib/drop";
import { primaryButtonClass, secondaryButtonClass } from "@/lib/styles";
import type { MatchCardModel, MatchType } from "@/lib/types";

export function MatchesBoard({
  matches,
  hasQuestionnaire,
}: {
  matches: MatchCardModel[];
  hasQuestionnaire: boolean;
}) {
  const [tab, setTab] = useState<MatchType>("friend");
  const visible = matches.filter((match) => match.matchType === tab);
  const friendCount = matches.filter((match) => match.matchType === "friend").length;
  const studyCount = matches.filter((match) => match.matchType === "study").length;
  const weeks = Array.from(new Set(visible.map((match) => match.weekStart)));

  return (
    <div>
      <div className="flex gap-2" role="tablist">
        <TabButton active={tab === "friend"} count={friendCount} onClick={() => setTab("friend")}>
          Friends
        </TabButton>
        <TabButton active={tab === "study"} count={studyCount} onClick={() => setTab("study")}>
          Study buddies
        </TabButton>
      </div>

      {visible.length === 0 ? (
        <EmptyState hasQuestionnaire={hasQuestionnaire} tab={tab} />
      ) : (
        <div className="mt-6 grid gap-8">
          {weeks.map((week) => (
            <section key={week}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Week of {formatWeek(week)}
              </h2>
              <div className="mt-3 grid gap-3">
                {visible
                  .filter((match) => match.weekStart === week)
                  .map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      aria-selected={active}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${
        active ? "bg-yale text-white" : "bg-white text-muted"
      }`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {children}
      <span className={active ? "text-white/80" : "text-muted"}> {count}</span>
    </button>
  );
}

function EmptyState({
  tab,
  hasQuestionnaire,
}: {
  tab: MatchType;
  hasQuestionnaire: boolean;
}) {
  if (!hasQuestionnaire) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-line bg-white px-5 py-8">
        <p className="font-medium">Finish the questionnaire before Monday.</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Friend matches are the main list. Study buddies only appear if you opt in.
        </p>
        <Link className={`${primaryButtonClass} mt-4`} href="/questionnaire">
          Open the questionnaire
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-3xl border border-dashed border-line bg-white px-5 py-8">
      <p className="font-medium">
        {tab === "friend" ? "No friend matches yet." : "No study buddies yet."}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">
        {tab === "friend"
          ? "Matches land once a week. If you just finished the questionnaire, the next drop will include you."
          : "Study buddies are optional and paired on their own. Turn the section on in your questionnaire if you want in."}
      </p>
    </div>
  );
}

function MatchCard({ match }: { match: MatchCardModel }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const waiting = match.viewerResponse === "interested" && match.status === "pending";
  const closed = match.status === "closed";
  const mutual = match.status === "mutual";

  function respond(response: "interested" | "passed") {
    setError("");
    startTransition(async () => {
      const result = await respondToMatch(match.id, response);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <article className="rounded-3xl border border-line bg-card px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-2xl text-ink">
          {match.partner.college}
          {match.partner.classYear > 0 ? (
            <span className="ml-2 font-sans text-base text-muted">
              Class of {match.partner.classYear}
            </span>
          ) : null}
        </h3>
        <p className="text-sm text-muted">Overlap {Math.round(match.score)}</p>
      </div>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink">{match.whyMatched}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {mutual ? (
          <Link className={primaryButtonClass} href={`/chat/${match.id}`}>
            Open chat
          </Link>
        ) : null}
        {!mutual && !closed && match.viewerResponse !== "interested" ? (
          <button
            className={primaryButtonClass}
            disabled={pending}
            onClick={() => respond("interested")}
            type="button"
          >
            Interested
          </button>
        ) : null}
        {!mutual && !closed && match.viewerResponse !== "passed" ? (
          <button
            className={secondaryButtonClass}
            disabled={pending}
            onClick={() => respond("passed")}
            type="button"
          >
            Pass
          </button>
        ) : null}
        {waiting ? <span className="text-sm text-muted">Waiting on them.</span> : null}
        {closed ? (
          <span className="text-sm text-muted">
            {match.viewerResponse === "passed" ? "You passed." : "This match is closed."}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-clay" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
